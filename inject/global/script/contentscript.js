'use strict';

window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();

var url = new URL(document.location.href).hostname;

browser.storage.local.get('sites', function(result) {
  if (result.sites.includes(url)) {
    browser.storage.local.get('font', function(items) {
      document.documentElement.style.setProperty(`--font`, items.font);
    });

    browser.storage.local.get('custom_fonts', function(fonts) {
      if (fonts.custom_fonts == undefined) {
        return;
      } else {
        var styles = '';
        Object.keys(fonts.custom_fonts).forEach(function(item) {
          styles =
            styles +
            `@font-face{  font-family:${item};src: url('${
              fonts.custom_fonts[item]
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
      browser.storage.local.get(['font', 'custom_fonts'], function(items) {
        if (changes.custom_fonts != undefined) {
          if (document.getElementById('custom-font')) {
            document.getElementById('custom-font').remove();
          }
          var styles = '';
          Object.keys(items.custom_fonts).forEach(function(item) {
            styles =
              styles +
              `@font-face{  font-family:${item};src: url('${
                items.custom_fonts[item]
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

        document.documentElement.style.setProperty(`--font`, items.font);
      });
    });
  } else {
    // console.log('no');
  }
});
