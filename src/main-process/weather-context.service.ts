type WeatherSnapshot = {
  fetchedAt: number;
  message: string;
};

const WEATHER_CACHE_MS = 30 * 60 * 1000;
let weatherCache: WeatherSnapshot | null = null;

const DEFAULT_CITY = process.env.WEATHER_CITY_NAME || '广东广州';
const DEFAULT_LAT = Number(process.env.WEATHER_LAT ?? 23.1291);
const DEFAULT_LON = Number(process.env.WEATHER_LON ?? 113.2644);

const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const HIGH_TEMP_THRESHOLD = 35;

type OpenMeteoDaily = {
  temperature_2m_max?: number[];
  weathercode?: number[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

const toFixed1 = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : `${n}`);

const buildWeatherContextMessage = (city: string, maxTemp: number | null, weatherCode: number | null): string => {
  const warningLines: string[] = [];
  if (maxTemp !== null && maxTemp >= HIGH_TEMP_THRESHOLD) {
    warningLines.push(`- 高温提示：今日最高温约 ${toFixed1(maxTemp)}°C，建议减少暴晒并注意补水。`);
  }
  if (weatherCode !== null && THUNDERSTORM_CODES.has(weatherCode)) {
    warningLines.push('- 雷暴提示：今日有雷暴风险，外出请关注临近预警并注意安全。');
  }

  const headline = `天气上下文（城市：${city}）：${maxTemp === null ? '暂无温度数据' : `今日最高温约 ${toFixed1(maxTemp)}°C`}，天气码：${weatherCode ?? 'unknown'}。`;
  const usage = '当用户问到天气、出行、穿衣、是否炎热/有雷雨时，优先引用以上信息；未命中天气话题不要硬插入天气。';
  if (!warningLines.length) {
    return [headline, '- 预警提示：暂无高温/雷暴预警。', usage].join('\n');
  }
  return [headline, ...warningLines, usage].join('\n');
};

export const getWeatherContextMessage = async (): Promise<string> => {
  const now = Date.now();
  if (weatherCache && now - weatherCache.fetchedAt < WEATHER_CACHE_MS) {
    return weatherCache.message;
  }

  try {
    const lat = Number.isFinite(DEFAULT_LAT) ? DEFAULT_LAT : 23.1291;
    const lon = Number.isFinite(DEFAULT_LON) ? DEFAULT_LON : 113.2644;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,weathercode&timezone=auto&forecast_days=1`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`weather http ${resp.status}`);
    }
    const data = (await resp.json()) as OpenMeteoResponse;
    const maxTemp = data.daily?.temperature_2m_max?.[0];
    const weatherCode = data.daily?.weathercode?.[0];
    const msg = buildWeatherContextMessage(
      DEFAULT_CITY,
      typeof maxTemp === 'number' ? maxTemp : null,
      typeof weatherCode === 'number' ? weatherCode : null,
    );
    weatherCache = { fetchedAt: now, message: msg };
    return msg;
  } catch {
    const fallback = [
      `天气上下文（城市：${DEFAULT_CITY}）：暂时无法获取实时天气数据。`,
      '若用户询问天气，请明确说明当前无法拉取天气源，并建议稍后重试。',
    ].join('\n');
    weatherCache = { fetchedAt: now, message: fallback };
    return fallback;
  }
};
