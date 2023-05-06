window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();

!(function() {
  function a() {
    h('#file').addEventListener('change', function() {
      var a = this.files[0],
        b = a.name.match(/\.[a-zA-Z]+$/);
      (b && '.ttf' === b[0].toLowerCase()) ||
      '.otf' === b[0].toLowerCase() ||
      '.woff' === b[0].toLowerCase()
        ? ((g = b[0]),
          (f = a),
          (h('#font-name').value = a.name
            .substring(0, a.name.indexOf('.'))
            .replace(/[^0-9a-z]/gi, '')))
        : ((f = null), alert('Font must be of type .ttf, .otf or .woff'));
    }),
      h('#save-font').addEventListener('click', function() {
        var a = h('#font-name').value;
        if (!/^[a-zA-Z ]*$/.test(a)) {
          alert('Please type a valid name.');
          return;
        }
        return a.trim()
          ? e[a]
            ? void alert('File name "' + a + '" is already in use.')
            : f
              ? void b(f, a, g)
              : void alert('Please select a file.')
          : void alert('Please type a name.');
      }),
      h('#delete-font').addEventListener('click', function() {
        var a = Array.prototype.slice.call(
          document.querySelectorAll('#saved-fonts option')
        );
        a &&
          (a.forEach(function(a) {
            if (a.selected) {
              var b = a.textContent;
              delete e[b], a.parentNode.removeChild(a);
            }
          }),
          browser.storage.local.set({
            custom_fonts: e
          }));
      });
  }
  function b(a, b, f) {
    var g = new FileReader();
    (g.onloadend = function(a) {
      var g = this.result,
        h = 'font/truetype';
      '.woff' === f ? (h = 'font/woff') : '.otf' === f && (h = 'font/opentype'),
        (e[b] = 'data:' + h + ';base64,' + g.replace(/data:.*?;base64,/, '')),
        browser.storage.local.set({
          custom_fonts: e
        }),
        c(),
        d();
    }),
      g.readAsDataURL(a, 'UTF-8');
  }
  function c() {
    var a = document.createDocumentFragment();
    Object.keys(e).forEach(function(b) {
      var c = document.createElement('option');
      (c.textContent = b), (c.value = e[b]), a.appendChild(c);
    });
    var b = h('#saved-fonts');
    (b.innerHTML = ''), b.appendChild(a);
  }
  function d() {
    (h('#font-name').value = ''), (h('#file').value = ''), (f = null);
  }
  var e = {},
    f = null,
    g = null,
    h = document.querySelector.bind(document);
  browser.storage.local.get('custom_fonts', function(a) {
    a.custom_fonts && ((e = a.custom_fonts), c());
  }),
    document.addEventListener(
      'DOMContentLoaded',
      function() {
        document.removeEventListener('DOMContentLoaded', arguments.callee, !1),
          a();
      },
      !1
    );
})();
