const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://x.test/', pretendToBeVisual: true });
for (const k of ['window','document','HTMLElement','Element','Node','MouseEvent','Event','localStorage']) global[k] = k==='window'?dom.window:dom.window[k];
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.cancelAnimationFrame = clearTimeout;
