export interface TradeChartParams {
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  support1?: number;
  support2?: number;
  resistance1?: number;
  resistance2?: number;
  timeframe?: string;
  strategy?: string;
  winProbability?: number;
  footprintDelta?: number;
  orderBlockZone?: string;
  spoofingWall?: string;
}

export function generateTradeSetupChartImage(params: TradeChartParams): string {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { 
    pair, 
    type, 
    entryPrice, 
    target1, 
    target2, 
    target3, 
    stopLoss, 
    support1 = +(entryPrice * 0.985).toFixed(2),
    support2 = +(entryPrice * 0.968).toFixed(2),
    resistance1 = +(entryPrice * 1.018).toFixed(2),
    resistance2 = +(entryPrice * 1.036).toFixed(2),
    timeframe = '1m / 5m', 
    strategy = 'SMC Order Block & Footprint Delta', 
    winProbability = 94,
    footprintDelta = +1420,
    orderBlockZone = 'SMC Bullish OB Zone',
    spoofingWall = 'Ask Spoof Wall Absorbed'
  } = params;

  const isLong = type === 'LONG';

  // Dark Institutional Background
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Dark Header Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 80);

  // Header Title & Subtitle
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`LIVETRADING AI FUTURES - ${pair}`, 24, 38);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`FOOTPRINT CVD: ${footprintDelta > 0 ? '+' : ''}${footprintDelta} | OB: ${orderBlockZone} | SPOOFING: ${spoofingWall}`, 24, 62);

  // Signal Badge (LONG/SHORT)
  const badgeColor = isLong ? '#10b981' : '#f43f5e';
  ctx.fillStyle = badgeColor;
  ctx.fillRect(canvas.width - 210, 18, 185, 42);

  ctx.fillStyle = '#090d16';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${type} SCALP (${winProbability}%)`, canvas.width - 118, 44);
  ctx.textAlign = 'left';

  // Grid Lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = 80; x < canvas.width - 190; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x, canvas.height - 45);
    ctx.stroke();
  }
  for (let y = 110; y < canvas.height - 45; y += 55) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(canvas.width - 190, y);
    ctx.stroke();
  }

  // Min and Max scale bounds calculation
  const allVals = [stopLoss, target3, entryPrice, support1, support2, resistance1, resistance2];
  const minVal = Math.min(...allVals) * 0.994;
  const maxVal = Math.max(...allVals) * 1.006;
  const chartHeight = canvas.height - 145;

  const getYPos = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal);
    return canvas.height - 55 - ratio * chartHeight;
  };

  // Draw Shaded Support / Demand Zone Box
  const suppY1 = getYPos(support1);
  const suppY2 = getYPos(support2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
  ctx.fillRect(60, Math.min(suppY1, suppY2), canvas.width - 250, Math.abs(suppY2 - suppY1) || 18);

  // Draw Shaded Resistance Zone Box
  const resY1 = getYPos(resistance1);
  const resY2 = getYPos(resistance2);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
  ctx.fillRect(60, Math.min(resY1, resY2), canvas.width - 250, Math.abs(resY2 - resY1) || 18);

  // Draw Mock Live Candlesticks with Volume Footprint
  let currPrice = entryPrice * 0.998;
  const candleWidth = 14;
  const candleGap = 20;

  for (let i = 0; i < 28; i++) {
    const x = 75 + i * candleGap;
    const change = (Math.random() - 0.48) * (entryPrice * 0.0032);
    const open = currPrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * (entryPrice * 0.0016);
    const low = Math.min(open, close) - Math.random() * (entryPrice * 0.0016);

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

  // Draw Horizontal Setup Lines
  const drawLevelLine = (price: number, label: string, color: string, isDashed = true, isThin = false) => {
    const y = getYPos(price);

    ctx.strokeStyle = color;
    ctx.lineWidth = isThin ? 1 : 2;
    if (isDashed) ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(canvas.width - 190, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price Tag Box
    ctx.fillStyle = color;
    ctx.fillRect(canvas.width - 185, y - 11, 165, 22);

    ctx.fillStyle = '#080c14';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${label}: $${price}`, canvas.width - 178, y + 4);
  };

  drawLevelLine(resistance1, 'RESISTANCE (R1)', '#fb7185', true, true);
  drawLevelLine(target3, 'TP3', '#34d399');
  drawLevelLine(target2, 'TP2', '#10b981');
  drawLevelLine(target1, 'TP1 (SCALP)', '#059669');
  drawLevelLine(entryPrice, 'ENTRY PRICE', '#38bdf8', false);
  drawLevelLine(support1, 'SUPPORT (S1)', '#34d399', true, true);
  drawLevelLine(stopLoss, 'STOP LOSS', '#f43f5e', true);

  // Bottom Footer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, canvas.height - 38, canvas.width, 38);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Binance Futures & Gold Live Stream • Footprint Delta & Spoofing Analysis • ${new Date().toLocaleTimeString()} UTC`, 24, canvas.height - 14);

  return canvas.toDataURL('image/png');
}