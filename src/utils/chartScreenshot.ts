export interface TradeChartParams {
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  timeframe?: string;
  strategy?: string;
  winProbability?: number;
}

export function generateTradeSetupChartImage(params: TradeChartParams): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { pair, type, entryPrice, target1, target2, target3, stopLoss, timeframe = '5m', strategy = 'SMC Order Block', winProbability = 92 } = params;
  const isLong = type === 'LONG';

  // Background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Dark Header Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 70);

  // Header Title & Badge
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`LIVETRADING AI - ${pair}`, 24, 38);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText(`Strategy: ${strategy} | Timeframe: ${timeframe} | Win Prob: ${winProbability}%`, 24, 58);

  // Signal Badge (LONG/SHORT)
  const badgeColor = isLong ? '#10b981' : '#f43f5e';
  ctx.fillStyle = badgeColor;
  ctx.fillRect(canvas.width - 200, 18, 175, 34);

  ctx.fillStyle = '#090d16';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${type} SETUP (LIVE)`, canvas.width - 112, 40);
  ctx.textAlign = 'left';

  // Grid Lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = 80; x < canvas.width - 180; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x, canvas.height - 40);
    ctx.stroke();
  }
  for (let y = 100; y < canvas.height - 40; y += 60) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(canvas.width - 180, y);
    ctx.stroke();
  }

  // Draw Mock Live Candlesticks
  const minVal = Math.min(stopLoss, target3, entryPrice) * 0.995;
  const maxVal = Math.max(stopLoss, target3, entryPrice) * 1.005;
  const chartHeight = canvas.height - 130;

  const getYPos = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal);
    return canvas.height - 50 - ratio * chartHeight;
  };

  let currPrice = entryPrice * 0.998;
  const candleWidth = 14;
  const candleGap = 20;

  for (let i = 0; i < 26; i++) {
    const x = 75 + i * candleGap;
    const change = (Math.random() - 0.48) * (entryPrice * 0.003);
    const open = currPrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * (entryPrice * 0.0015);
    const low = Math.min(open, close) - Math.random() * (entryPrice * 0.0015);

    const isBull = close >= open;
    ctx.strokeStyle = isBull ? '#10b981' : '#f43f5e';
    ctx.fillStyle = isBull ? '#10b981' : '#f43f5e';

    // Wick
    ctx.beginPath();
    ctx.moveTo(x + candleWidth / 2, getYPos(high));
    ctx.lineTo(x + candleWidth / 2, getYPos(low));
    ctx.stroke();

    // Body
    const yTop = getYPos(Math.max(open, close));
    const yBottom = getYPos(Math.min(open, close));
    ctx.fillRect(x, yTop, candleWidth, Math.max(2, yBottom - yTop));

    currPrice = close;
  }

  // Draw Horizontal Setup Lines (Entry, TP1, TP2, TP3, Stop Loss)
  const drawLevelLine = (price: number, label: string, color: string, isDashed = true) => {
    const y = getYPos(price);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (isDashed) ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(canvas.width - 180, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price Pill Tag on Right Axis
    ctx.fillStyle = color;
    ctx.fillRect(canvas.width - 175, y - 12, 155, 24);

    ctx.fillStyle = '#090d16';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${label}: $${price}`, canvas.width - 168, y + 4);
  };

  // Draw TP3
  drawLevelLine(target3, 'TP3', '#34d399');

  // Draw TP2
  drawLevelLine(target2, 'TP2', '#10b981');

  // Draw TP1
  drawLevelLine(target1, 'TP1', '#059669');

  // Draw Entry Line
  drawLevelLine(entryPrice, 'ENTRY', '#38bdf8', false);

  // Draw Stop Loss Line
  drawLevelLine(stopLoss, 'STOP LOSS', '#f43f5e', true);

  // Bottom Footer Timestamp Tag
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, canvas.height - 35, canvas.width, 35);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Generated Live Spot Signal • Time: ${new Date().toLocaleTimeString()} • Live Trading AI Engine`, 24, canvas.height - 12);

  return canvas.toDataURL('image/png');
}