#!/bin/bash
# Autonomous trade cycle - called by cron every 4 hours
# This triggers a heartbeat-style message to Claw to run a sentiment analysis + trade

echo "[$(date -u)] Starting autonomous trade cycle..."
cd /home/openclaw/projects/synthesis-hackathon

# Gather market data
node -e "
async function main() {
  const [priceRes, tvlRes] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true'),
    fetch('https://api.llama.fi/v2/historicalChainTvl/Base')
  ]);
  const price = await priceRes.json();
  const tvl = await tvlRes.json();
  const baseTvl = tvl[tvl.length-1]?.tvl;
  
  console.log(JSON.stringify({
    ethPrice: price.ethereum.usd,
    change24h: price.ethereum.usd_24h_change,
    volume24h: price.ethereum.usd_24h_vol,
    baseTvl: baseTvl,
    timestamp: new Date().toISOString()
  }));
}
main().catch(e => console.error(e.message));
" > /tmp/market-data.json 2>&1

echo "[$(date -u)] Market data gathered"
cat /tmp/market-data.json
echo "[$(date -u)] Cycle complete - Claw will make trading decision via OpenClaw heartbeat"
