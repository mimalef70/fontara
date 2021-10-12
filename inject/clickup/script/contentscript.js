'use strict';

window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();

browser.storage.local.get(['font', 'clickup'], function(configs) {
  const callback = (mutations, observer) => {
    observer.disconnect();
    setFont(configs);
  };
  new MutationObserver(callback).observe(document.body, {
    attributes: true,
    attributeFilter: ['style']
  });
});

browser.storage.local.get('custom_fonts', function(fonts) {
  if (fonts.custom_fonts == undefined) {
    return;
  } else {
    var styles = '';
    Object.keys(fonts.custom_fonts).forEach(function(font) {
      styles =
        styles +
        `@font-face{  font-family:${font};src: url('${
          fonts.custom_fonts[font]
        }');}`;
    });
    var element = document.createElement('style');
    (element.type = 'text/css'),
      (element.innerText = styles),
      (element.id = 'custom-font');
    document.head
      ? document.head.appendChild(element)
      : document.documentElement.appendChild(element);
  }
});

browser.storage.onChanged.addListener(function(changes, namespace) {
  browser.storage.local.get(['font', 'clickup', 'custom_fonts'], (configs) => {
      if (changes.custom_fonts != undefined) {
        if (document.getElementById('custom-font')) {
          document.getElementById('custom-font').remove();
        }
        var styles = '';
        Object.keys(configs.custom_fonts).forEach(function (font) {
          styles =
            styles +
            `@font-face{  font-family:${font};src: url('${configs.custom_fonts[font]}');}`;
        });
        var element = document.createElement('style');
        (element.type = 'text/css'),
          (element.innerText = styles),
          (element.id = 'custom-font');
        document.head
          ? document.head.appendChild(element)
          : document.documentElement.appendChild(element);
      }
      setFont(configs);
    });
});

function setFont(configs) {
  const currentFont = document.body.style.getPropertyValue('--font');
  if (configs.clickup == true || configs.clickup == undefined) {
    document.body.style.setProperty(`--font`,`${configs.font}, ${currentFont}`);
  } else {  
    document.documentElement.style.setProperty(`--font`, currentFont.substr(currentFont.indexOf(',')));
  }
}