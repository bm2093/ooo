import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // This is a simple HTML page that will show localStorage data
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Stock Data Debug</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .hit-yes { color: green; font-weight: bold; }
        .hit-no { color: red; font-weight: bold; }
        .hit-na { color: gray; }
    </style>
</head>
<body>
    <h1>Stock Data Debug</h1>
    <div id="output"></div>
    
    <script>
        const STORAGE_KEY = 'stockTracker_positions';
        const data = localStorage.getItem(STORAGE_KEY);
        const stocks = data ? JSON.parse(data) : [];
        
        const output = document.getElementById('output');
        
        if (stocks.length === 0) {
            output.innerHTML = '<p>No stocks found in localStorage</p>';
        } else {
            let html = \`<h2>\${stocks.length} stocks found:</h2>\`;
            html += '<table border="1" style="border-collapse: collapse; margin: 20px 0;">';
            html += '<tr><th>Ticker</th><th>Current Price</th><th>Target 1</th><th>T1 Hit</th><th>Target 2</th><th>T2 Hit</th><th>Target 3</th><th>T3 Hit</th><th>Stop Loss</th><th>Buy Zone Low</th><th>Buy Zone High</th><th>Callout</th></tr>';
            
            stocks.forEach(stock => {
                const t1Class = stock.target1Hit === 'YES' ? 'hit-yes' : (stock.target1Hit === 'NO' ? 'hit-no' : 'hit-na');
                const t2Class = stock.target2Hit === 'YES' ? 'hit-yes' : (stock.target2Hit === 'NO' ? 'hit-no' : 'hit-na');
                const t3Class = stock.target3Hit === 'YES' ? 'hit-yes' : (stock.target3Hit === 'NO' ? 'hit-no' : 'hit-na');
                const buyZoneClass = stock.buyZoneHit === 'YES' ? 'hit-yes' : (stock.buyZoneHit === 'NO' ? 'hit-no' : 'hit-na');
                
                html += \`<tr>
                    <td>\${stock.ticker}</td>
                    <td>\${stock.currentPrice}</td>
                    <td>\${stock.target1 || '-'}</td>
                    <td class="\${t1Class}">\${stock.target1Hit || '-'}</td>
                    <td>\${stock.target2 || '-'}</td>
                    <td class="\${t2Class}">\${stock.target2Hit || '-'}</td>
                    <td>\${stock.target3 || '-'}</td>
                    <td class="\${t3Class}">\${stock.target3Hit || '-'}</td>
                    <td>\${stock.stopLoss || '-'}</td>
                    <td>\${stock.buyZoneLow || '-'}</td>
                    <td>\${stock.buyZoneHigh || '-'}</td>
                    <td class="\${buyZoneClass}">\${stock.buyZoneHit || '-'}</td>
                    <td>\${stock.calloutPrice}</td>
                </tr>\`;
            });
            
            html += '</table>';
            html += '<button onclick="testTargetDetection()">Test Target Detection</button>';
            html += '<div id="test-results"></div>';
            output.innerHTML = html;
        }
        
        function testTargetDetection() {
            const testResults = document.getElementById('test-results');
            testResults.innerHTML = '<p>Testing target detection...</p>';
            
            fetch('/api/stocks/test-targets', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    console.log('Test results:', data);
                    testResults.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                })
                .catch(error => {
                    console.error('Test failed:', error);
                    testResults.innerHTML = '<p>Test failed: ' + error.message + '</p>';
                });
        }
    </script>
</body>
</html>`;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load debug page' }, { status: 500 });
  }
}