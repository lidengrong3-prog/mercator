const CDP = require('chrome-remote-interface');
async function test() {
  let client;
  try {
    client = await CDP();
    const {Page, Runtime, DOM} = client;
    await Page.enable();
    await Runtime.enable();
    await Page.navigate({url: 'https://5cd8f877342041f5b6940719bc34ccf4.app.codebuddy.work'});
    await new Promise(r => setTimeout(r, 2500));
    
    await Runtime.evaluate({expression: `
      document.getElementById('ov-hero-input').value = '水晶';
      document.getElementById('ov-hero-send').click();
      'clicked';
    `});
    
    await new Promise(r => setTimeout(r, 2000));
    
    const result = await Runtime.evaluate({expression: `
      (function(){
        var el = document.getElementById('ov-hero-result');
        return {
          display: el ? el.style.display : 'no-el',
          htmlLength: el ? el.innerHTML.length : 0,
          text: el ? el.innerText.substring(0, 300) : ''
        };
      })();
    `, returnByValue: true});
    
    console.log('Result:', JSON.stringify(result.result.value, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) await client.close();
  }
}
test();
