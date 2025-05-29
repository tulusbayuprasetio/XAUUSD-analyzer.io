  // API Keys
  const newsApiKey = '3d1b039b2dc14aad93dadbbc1e747c89';
  const twelveDataApiKey = '7b627ab249ec45f189afc32d5dfc388f';
  const finnhubApiKey = 'd0cbmqpr01ql2j3c4fh0d0cbmqpr01ql2j3c4fhg';

  // DOM Elements
  const priceDisplay = document.getElementById('price');
  const signalDisplay = document.getElementById('signal');
  const timeframeSelect = document.getElementById('timeframe');
  const newsList = document.getElementById('newsList');
  const ctx = document.getElementById('priceChart').getContext('2d');
  const ctxMacd = document.getElementById('macdChart').getContext('2d');
  const sma5Display = document.getElementById('sma5');
  const sma20Display = document.getElementById('sma20');
  const rsiDisplay = document.getElementById('rsi');
  const macdDisplay = document.getElementById('macd');
  const adxDisplay = document.getElementById('adx');
  const trendDisplay = document.getElementById('trend');
  const lastUpdateDisplay = document.getElementById('lastUpdate');
  
  let priceChart = null;
  let macdChart = null;
  let lastPrice = 0;

  // Timeframe map for multiple APIs
  const timeFrameMap = {
    '5min': '5min',
    '15min': '15min',
    '30min': '30min',
    '1h': '1h',
    '4h': '4h',
    '1day': '1day'
  };

  // Fetch price data from Twelve Data API
  async function fetchPriceData(interval) {
    const symbol = 'XAU/USD';
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&apikey=${twelveDataApiKey}&format=json&outputsize=200`;
    try {
      const response = await fetch(url);
      const data = await response.json();

      console.log('Response dari Twelve Data:', data);

      if (data.status === 'error' || !data.values || data.values.length < 20) {
        console.warn('Twelve Data API Error atau data tidak cukup:', data.message || 'Kurang data');
        return await fetchPriceDataFallback(interval);
      }
      return data;
    } catch (err) {
      console.error('Error fetch from Twelve Data:', err);
      return await fetchPriceDataFallback(interval);
    }
  }

  // Fallback fetch price data dari Finnhub
  async function fetchPriceDataFallback(interval) {
    const resolutionMap = {
      '5min': '5',
      '15min': '15',
      '30min': '30',
      '1h': '60',
      '4h': '240',
      '1day': 'D'
    };
    const resolution = resolutionMap[interval] || '60';
    const now = Math.floor(Date.now() / 1000);
    const from = now - (86400 * 14); // 14 hari
    const to = now;

    try {
      const url = `https://finnhub.io/api/v1/forex/candle?symbol=OANDA:XAU_USD&resolution=${resolution}&from=${from}&to=${to}&token=${finnhubApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      console.log('Response fallback dari Finnhub:', data);

      if (data.s === 'ok' && data.c && data.c.length >= 20 && data.t && data.t.length === data.c.length) {
        // Format data agar cocok dengan Twelve Data
        const formattedData = {
          values: data.c.map((close, i) => ({
            datetime: new Date(data.t[i] * 1000).toISOString(),
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: close
          }))
        };
        return formattedData;
      } else {
        console.warn('Finnhub fallback API: Data kurang lengkap atau invalid');
        return null;
      }
    } catch (err) {
      console.error('Error fetch fallback from Finnhub:', err);
      return null;
    }
  }

  // Siapkan data chart
  function prepareChartData(data) {
    if (!data || !data.values || data.values.length < 20) {
      console.error('Data tidak valid untuk chart:', data);
      return null;
    }
    const reversedValues = data.values.slice().reverse();

    const labels = reversedValues.map(v => {
      const d = new Date(v.datetime);
      if (timeframeSelect.value === '1day') {
        return d.toLocaleDateString('id-ID');
      }
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    });

    const prices = reversedValues.map(v => parseFloat(v.close));
    lastPrice = prices[prices.length - 1];
    return { labels, prices, values: reversedValues };
  }

  // SMA calculation
  function calculateSMA(data, period) {
    const prices = data.values.map(v => parseFloat(v.close));
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const avg =
        prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      sma.push(avg);
    }
    return sma;
  }

  // Bollinger Bands calculation
  function calculateBollingerBands(data, period = 20, multiplier = 2) {
    const prices = data.values.map(v => parseFloat(v.close));
    if (prices.length < period) return { upper: [], middle: [], lower: [] };
    const middle = calculateSMA(data, period);
    const upper = [];
    const lower = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance =
        slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mean + multiplier * stdDev);
      lower.push(mean - multiplier * stdDev);
    }
    return { upper, middle, lower };
  }

  // Initialize/update price chart
  function initChart(labels, prices, sma5Values, sma20Values, bollinger) {
    const adjustedSMA5 = Array(labels.length - sma5Values.length).fill(null).concat(sma5Values);
    const adjustedSMA20 = Array(labels.length - sma20Values.length).fill(null).concat(sma20Values);
    const adjustedBollUpper = Array(labels.length - bollinger.upper.length).fill(null).concat(bollinger.upper);
    const adjustedBollLower = Array(labels.length - bollinger.lower.length).fill(null).concat(bollinger.lower);

    if (priceChart) {
      priceChart.data.labels = labels;
      priceChart.data.datasets[0].data = prices;
      priceChart.data.datasets[1].data = adjustedSMA5;
      priceChart.data.datasets[2].data = adjustedSMA20;
      priceChart.data.datasets[3].data = adjustedBollUpper;
      priceChart.data.datasets[4].data = adjustedBollLower;
      priceChart.update();
    } else {
      priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Harga XAU/USD',
              data: prices,
              borderColor: '#fbbf24',
              backgroundColor: 'rgba(251, 191, 36, 0.2)',
              tension: 0.3,
              fill: true,
              pointRadius: 0,
              borderWidth: 2,
              yAxisID: 'y'
            },
            {
              label: 'SMA 5',
              data: adjustedSMA5,
              borderColor: '#4ade80',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0,
              yAxisID: 'y'
            },
            {
              label: 'SMA 20',
              data: adjustedSMA20,
              borderColor: '#f87171',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0,
              yAxisID: 'y'
            },
            {
              label: 'Bollinger Upper',
              data: adjustedBollUpper,
              borderColor: '#00b7eb',
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderDash: [6, 4],
              pointRadius: 0,
              yAxisID: 'y'
            },
            {
              label: 'Bollinger Lower',
              data: adjustedBollLower,
              borderColor: '#00b7eb',
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderDash: [6, 4],
              pointRadius: 0,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: '#fbbf24', maxRotation: 45, minRotation: 30 },
              grid: { color: '#374151' },
            },
            y: {
              beginAtZero: false,
              ticks: { color: '#fbbf24' },
              grid: { color: '#374151' },
              position: 'left',
            },
          },
          plugins: {
            legend: {
              labels: { color: '#fbbf24', font: { weight: '600' } },
              position: 'top',
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: '#1f2937',
              titleColor: '#fbbf24',
              bodyColor: 'white',
              callbacks: {
                label: (context) => {
                  return (
                    context.dataset.label +
                    ': ' +
                    context.parsed.y.toFixed(2)
                  );
                },
              },
            },
          },
          interaction: {
            mode: 'nearest',
            intersect: false,
          },
        },
      });
    }
  }

  // RSI calculation
  function calculateRSI(data, period = 14) {
    const prices = data.values.map((v) => parseFloat(v.close));
    if (prices.length < period + 1) return 50;

    let gains = [];
    let losses = [];

    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);
    }
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgLoss === 0 ? 9999 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    return rsi;
  }

  // EMA helper for MACD
  function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let emaArray = [];
    let ema =
      prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaArray[period - 1] = ema;
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
      emaArray[i] = ema;
    }
    return emaArray;
  }

  // MACD calculation
  function calculateMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const prices = data.values.map((v) => parseFloat(v.close));
    if (prices.length < longPeriod + signalPeriod) return { macd: 0, signal: 0, histogram: 0 };

    const emaShort = calculateEMA(prices, shortPeriod);
    const emaLong = calculateEMA(prices, longPeriod);
    const macdLine = emaShort
      .map((val, i) => {
        if (i < longPeriod - 1) return null;
        return val - emaLong[i];
      })
      .filter((v) => v !== null);
    const signalLine = calculateEMA(macdLine, signalPeriod).slice(signalPeriod - 1);

    if (macdLine.length === 0 || signalLine.length === 0)
      return { macd: 0, signal: 0, histogram: 0 };

    const macdLatest = macdLine[macdLine.length - 1];
    const signalLatest = signalLine[signalLine.length - 1];
    const histogram = macdLatest - signalLatest;
    return { macd: macdLatest, signal: signalLatest, histogram };
  }

  // ADX calculation (simplified)
  function calculateADX(data, period = 14) {
    const highs = data.values.map((v) => parseFloat(v.high));
    const lows = data.values.map((v) => parseFloat(v.low));
    const closes = data.values.map((v) => parseFloat(v.close));
    if (highs.length < period + 1) return 0;

    function trueRange(i) {
      return Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
    }

    function plusDM(i) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      if (upMove > downMove && upMove > 0) return upMove;
      return 0;
    }

    function minusDM(i) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      if (downMove > upMove && downMove > 0) return downMove;
      return 0;
    }

    let trSum = 0,
      plusDMSum = 0,
      minusDMSum = 0;

    for (let i = 1; i <= period; i++) {
      trSum += trueRange(i);
      plusDMSum += plusDM(i);
      minusDMSum += minusDM(i);
    }

    let plusDI = 0,
      minusDI = 0,
      dx = 0;
    if (trSum === 0) return 0;

    plusDI = (plusDMSum / trSum) * 100;
    minusDI = (minusDMSum / trSum) * 100;
    dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

    // Sederhana, return DX tanpa smoothing lebih lanjut
    return dx;
  }

  // Signal generation logic
  function getTimeframeParams(timeframe) {
    const params = {
      '5min': { rsiBuy: 30, rsiSell: 70, smaDiffThreshold: 1.8 },
      '15min': { rsiBuy: 30, rsiSell: 70, smaDiffThreshold: 1.5 },
      '30min': { rsiBuy: 35, rsiSell: 65, smaDiffThreshold: 1.5 },
      '1h': { rsiBuy: 40, rsiSell: 60, smaDiffThreshold: 1.2 },
      '4h': { rsiBuy: 45, rsiSell: 55, smaDiffThreshold: 1.0 },
      '1day': { rsiBuy: 50, rsiSell: 50, smaDiffThreshold: 0.8 }
    };
    return params[timeframe] || params['1h'];
  }

  function generateSignal(smaShort, smaLong, rsi, currentPrice, macd, adx, bollinger) {
    const { rsiBuy, rsiSell, smaDiffThreshold } = getTimeframeParams(timeframeSelect.value);
    const smaDiffPct = ((smaShort - smaLong) / smaLong) * 100;
    const priceAboveSMA = currentPrice > smaShort && currentPrice > smaLong;
    const priceBelowSMA = currentPrice < smaShort && currentPrice < smaLong;
    const macdBullish = macd.macd > macd.signal && macd.histogram > 0;
    const macdBearish = macd.macd < macd.signal && macd.histogram < 0;
    const strongTrend = adx > 25;
    const priceAboveUpperBand = bollinger.upper.length > 0 ? currentPrice > bollinger.upper[bollinger.upper.length - 1] : false;
    const priceBelowLowerBand = bollinger.lower.length > 0 ? currentPrice < bollinger.lower[bollinger.lower.length - 1] : false;

    if (smaShort > smaLong && rsi < rsiBuy && smaDiffPct > smaDiffThreshold && macdBullish && strongTrend && priceBelowLowerBand) {
      return {
        text: '🟢 BELI KUAT (SMA Bullish, RSI Oversold, MACD Bullish, Tren Kuat, Dekat Lower Band)',
        class: 'buy-signal',
        trend: 'Uptrend Kuat'
      };
    }
    if (smaShort < smaLong && rsi > rsiSell && smaDiffPct < -smaDiffThreshold && macdBearish && strongTrend && priceAboveUpperBand) {
      return {
        text: '🔴 JUAL KUAT (SMA Bearish, RSI Overbought, MACD Bearish, Tren Kuat, Dekat Upper Band)',
        class: 'sell-signal',
        trend: 'Downtrend Kuat'
      };
    }
    if (priceAboveSMA && rsi < 50 && macdBullish && !priceAboveUpperBand) {
      return {
        text: '🟢 BELI (Harga di Atas SMA, RSI Netral, MACD Bullish)',
        class: 'buy-signal',
        trend: 'Uptrend'
      };
    }
    if (priceBelowSMA && rsi > 50 && macdBearish && !priceBelowLowerBand) {
      return {
        text: '🔴 JUAL (Harga di Bawah SMA, RSI Netral, MACD Bearish)',
        class: 'sell-signal',
        trend: 'Downtrend'
      };
    }
    if (smaShort > smaLong && macdBullish) {
      return {
        text: '↑ Tren Naik - Tunggu Konfirmasi Lebih Kuat',
        class: 'trend-up',
        trend: 'Uptrend'
      };
    }
    if (smaShort < smaLong && macdBearish) {
      return {
        text: '↓ Tren Turun - Tunggu Konfirmasi Lebih Kuat',
        class: 'trend-down',
        trend: 'Downtrend'
      };
    }
    return {
      text: '➖ Netral (Tidak Ada Sinyal Jelas)',
      class: 'neutral-signal',
      trend: 'Netral'
    };
  }

  // Update Price, Chart, Indicators and Signal
  async function updatePriceAndChart() {
    priceDisplay.textContent = 'Loading data...';
    signalDisplay.textContent = 'Sinyal: Loading...';
    signalDisplay.className = 'neutral-signal';

    const interval = timeframeSelect.value;
    const dataRaw = await fetchPriceData(interval);
    if (!dataRaw || !dataRaw.values || dataRaw.values.length < 20) {
      priceDisplay.textContent = 'Error: Data tidak cukup';
      signalDisplay.textContent = 'Sinyal: Data tidak cukup';
      signalDisplay.className = 'neutral-signal';

      sma5Display.textContent = '-';
      sma20Display.textContent = '-';
      rsiDisplay.textContent = '-';
      macdDisplay.textContent = '-';
      adxDisplay.textContent = '-';
      trendDisplay.textContent = '-';

      if (priceChart) {
        priceChart.destroy();
        priceChart = null;
      }
      if (macdChart) {
        macdChart.destroy();
        macdChart = null;
      }

      return;
    }

    const chartData = prepareChartData(dataRaw);
    if (!chartData) {
      priceDisplay.textContent = 'Error: Format data tidak valid';
      signalDisplay.textContent = 'Sinyal: Data tidak valid';
      signalDisplay.className = 'neutral-signal';
      return;
    }

    // Hitung indikator teknis
    const sma5Values = calculateSMA(chartData, 5);
    const sma20Values = calculateSMA(chartData, 20);
    const rsiValue = calculateRSI(chartData, 14);
    const macdValue = calculateMACD(chartData);
    const adxValue = calculateADX(chartData);
    const bollingerValue = calculateBollingerBands(chartData);

    const sma5Last = sma5Values.length > 0 ? sma5Values[sma5Values.length - 1] : 0;
    const sma20Last = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1] : 0;

    sma5Display.textContent = sma5Last ? sma5Last.toFixed(2) : '-';
    sma20Display.textContent = sma20Last ? sma20Last.toFixed(2) : '-';
    rsiDisplay.textContent = rsiValue ? rsiValue.toFixed(2) : '-';
    macdDisplay.textContent = (macdValue.macd && macdValue.signal) ? `${macdValue.macd.toFixed(2)} / ${macdValue.signal.toFixed(2)}` : '-';
    adxDisplay.textContent = adxValue ? adxValue.toFixed(2) : '-';

    // Generate signal
    const signal = generateSignal(sma5Last, sma20Last, rsiValue, lastPrice, macdValue, adxValue, bollingerValue);

    signalDisplay.textContent = `Sinyal: ${signal.text}`;
    signalDisplay.className = signal.class;
    trendDisplay.textContent = signal.trend;
    priceDisplay.textContent = `Harga: $${lastPrice.toFixed(2)}`;

    // Render charts
    initChart(chartData.labels, chartData.prices, sma5Values, sma20Values, bollingerValue);

    // MACD Chart rendering
    const macdDataset = [];
    for(let i=26; i < chartData.values.length; i++) {
      const sliceData = {values: chartData.values.slice(0,i+1)};
      const val = calculateMACD(sliceData);
      macdDataset.push(val);
    }
  
    const macdLine = macdDataset.map(d => d.macd);
    const signalLine = macdDataset.map(d => d.signal);
    const histogram = macdDataset.map(d => d.histogram);

    if(macdChart) {
      macdChart.data.labels = chartData.labels.slice(-macdLine.length);
      macdChart.data.datasets[0].data = macdLine;
      macdChart.data.datasets[1].data = signalLine;
      macdChart.data.datasets[2].data = histogram;
      macdChart.update();
    } else {
      macdChart = new Chart(ctxMacd, {
        type: 'bar',
        data: {
          labels: chartData.labels.slice(-macdLine.length),
          datasets: [
            {
              label: 'MACD Line',
              data: macdLine,
              type: 'line',
              borderColor: '#4ade80',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0,
              yAxisID: 'y'
            },
            {
              label: 'Signal Line',
              data: signalLine,
              type: 'line',
              borderColor: '#f87171',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0,
              yAxisID: 'y'
            },
            {
              label: 'Histogram',
              data: histogram,
              backgroundColor: histogram.map(v =>
                v >= 0 ? 'rgba(74, 222, 128, 0.4)' : 'rgba(248, 113, 113, 0.4)'
              ),
              borderColor: 'transparent',
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: '#fbbf24' }, grid: { color: '#374151' } },
            y: { beginAtZero: true, ticks: { color: '#fbbf24' }, grid: { color: '#374151' } }
          },
          plugins: {
            legend: { labels: { color: '#fbbf24', font: { weight: '600' } }, position: 'top' },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: '#1f2937',
              titleColor: '#fbbf24',
              bodyColor: 'white'
            }
          }
        }
      });
    }
    lastUpdateDisplay.textContent = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
  }

  // Determine news impact
  function determineImpactLevel(title, content) {
    const text = (title + ' ' + (content || '')).toLowerCase();

    const highImpactKeywords = [
      'federal reserve', 'fomc', 'interest rate', 'inflation',
      'non-farm payroll', 'nfp', 'cpi', 'ppi', 'recession',
      'geopolitical crisis', 'war', 'sanctions', 'gold reserves',
      'rate hike', 'fed minutes', 'balance sheet'
    ];

    const mediumImpactKeywords = [
      'unemployment', 'usd', 'dollar', 'yield curve',
      'quantitative easing', 'economic growth', 'gdp',
      'gold demand', 'central bank gold'
    ];

    for (const keyword of highImpactKeywords) {
      if (text.includes(keyword)) return 'high';
    }
    for (const keyword of mediumImpactKeywords) {
      if (text.includes(keyword)) return 'medium';
    }
    return 'low';
  }

  // Fetch market news
  async function fetchMarketNews() {
    const queries = [
      'Federal Reserve OR FOMC OR "interest rates" OR "rate hike" OR inflation',
      'CPI OR PPI OR "non-farm payroll" OR NFP OR recession',
      'USD OR Dollar OR "US Treasury" OR yield curve',
      'geopolitical OR crisis OR war OR sanctions',
      'gold reserves OR "central bank gold" OR "gold demand"',
      'economic growth OR GDP OR unemployment OR "quantitative easing"'
    ];
    let allArticles = [];

    try {
      for (const query of queries) {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=4&apiKey=${newsApiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'ok' && data.articles) {
          const filteredNew = data.articles.filter(article =>
            !allArticles.some(existing => existing.url === article.url)
          );
          allArticles = [...allArticles, ...filteredNew];
        }
        await new Promise(resolve => setTimeout(resolve, 250)); // delay to reduce API calls
      }
      allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      return allArticles.slice(0, 10);
    } catch (err) {
      console.error('Error fetching market news:', err);
      return [];
    }
  }

  // Render news
  function renderNews(articles) {
    if (!articles.length) {
      newsList.innerHTML = '<p>Tidak ada berita terbaru yang mempengaruhi pasar.</p>';
      return;
    }
    newsList.innerHTML = articles.map(article => {
      const dateStr = new Date(article.publishedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const impact = determineImpactLevel(article.title, article.description || '');
      const impactClass = impact === 'high' ? 'high-impact' : impact === 'medium' ? 'medium-impact' : 'low-impact';
      const impactText = impact === 'high' ? 'Dampak Tinggi' : impact === 'medium' ? 'Dampak Sedang' : 'Dampak Rendah';
      return `
        <article class="news-item" tabindex="0">
          <a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>
          <p><small>${article.source.name} - ${dateStr}</small></p>
          <p>${article.description ? (article.description.length > 140 ? article.description.substring(0, 140) + '...' : article.description) : ''}</p>
          <span class="impact ${impactClass}" aria-label="${impactText}">${impactText}</span>
        </article>
      `;
    }).join('');
  }

  // Initialize app
  async function init() {
    await updatePriceAndChart();
    const news = await fetchMarketNews();
    renderNews(news);
  }

  timeframeSelect.addEventListener('change', () => updatePriceAndChart());
  
  // Update price & chart every 60 seconds
  setInterval(updatePriceAndChart, 20000);
  // Update market news every 10 minutes
  setInterval(async () => {
    const news = await fetchMarketNews();
    renderNews(news);
  }, 500000);

  window.onload = init;