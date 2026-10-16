const supabase = require('../config/supabase');
const { HttpError } = require('../middleware/errorHandler');

function ensureQuerySucceeded(error, operation) {
  if (error) {
    console.error(`${operation} failed:`, error);
    throw new HttpError(500, 'Database query failed');
  }
}

async function getCities() {
  const { data, error } = await supabase.from('cities').select('id,name').order('name');
  ensureQuerySucceeded(error, 'getCities');
  return data;
}

async function getMoviesByCity(city) {
  const cityColumn = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(city)
    ? 'id'
    : 'name';
  const cityResult = await supabase.from('cities').select('id').eq(cityColumn, city).maybeSingle();
  ensureQuerySucceeded(cityResult.error, 'findCity');
  if (!cityResult.data) throw new HttpError(404, 'City not found');

  const theatreResult = await supabase
    .from('theatres')
    .select('id')
    .eq('city_id', cityResult.data.id);
  ensureQuerySucceeded(theatreResult.error, 'findTheatres');
  if (theatreResult.data.length === 0) return [];

  const screenResult = await supabase
    .from('screens')
    .select('id')
    .in('theatre_id', theatreResult.data.map((theatre) => theatre.id));
  ensureQuerySucceeded(screenResult.error, 'findScreens');
  if (screenResult.data.length === 0) return [];

  const showResult = await supabase
    .from('shows')
    .select('movie_id')
    .in('screen_id', screenResult.data.map((screen) => screen.id));
  ensureQuerySucceeded(showResult.error, 'findMoviesInCity');
  const movieIds = [...new Set(showResult.data.map((show) => show.movie_id))];
  if (movieIds.length === 0) return [];

  const movieResult = await supabase
    .from('movies')
    .select('id,title,duration_mins,language,genre,poster_url')
    .in('id', movieIds)
    .order('title');
  ensureQuerySucceeded(movieResult.error, 'getMoviesByCity');
  return movieResult.data;
}

async function getShowsForMovie(movieId, date) {
  const movieResult = await supabase.from('movies').select('id').eq('id', movieId).maybeSingle();
  ensureQuerySucceeded(movieResult.error, 'findMovie');
  if (!movieResult.data) throw new HttpError(404, 'Movie not found');

  let query = supabase
    .from('shows')
    .select(`
      id,movie_id,start_time,end_time,base_price,
      screen:screens(id,name,theatre:theatres(id,name,address,city:cities(id,name)))
    `)
    .eq('movie_id', movieId)
    .order('start_time');

  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    query = query.gte('start_time', start.toISOString()).lt('start_time', nextDay.toISOString());
  }

  const { data, error } = await query;
  ensureQuerySucceeded(error, 'getShowsForMovie');
  return data;
}

module.exports = { getCities, getMoviesByCity, getShowsForMovie };
