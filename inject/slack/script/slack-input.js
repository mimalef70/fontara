window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();
browser.storage.local.get('slack', function(items) {
  if (items.slack == true || items.slack == undefined) {
    var RTL_CHARACTERS = '֑-߿‏‫‮יִ-﷽ﹰ-ﻼ';
    var RTL_REGEX = new RegExp(
      '^[^' + RTL_CHARACTERS + ']*?[' + RTL_CHARACTERS + ']'
    );

    var isRTL = function(str) {
      return RTL_REGEX.test(str);
    };

    var msgInputElement =
      document.querySelector('#msg_input .ql-editor') ||
      document.querySelector('#msg_input');

    var rtlifyInput = function(e) {
      if (isRTL(this.value || this.innerText)) {
        this.classList.add('rtl-input');
      } else {
        this.classList.remove('rtl-input');
      }
    }.bind(msgInputElement);

    // Minor timeout for when the paste event triggers before the text is available
    var timeoutRtlifyFunc = function() {
      setTimeout(rtlifyInput, 20);
    };
    msgInputElement.oninput = msgInputElement.onkeyup = msgInputElement.onpaste = msgInputElement.onchange = msgInputElement.onpropertychange = timeoutRtlifyFunc;
    var target = document.getElementById('msg_input');
    var observer = new MutationObserver(function(mutations) {
      mutations = mutations.filter(function(mutation) {
        return (
          mutation.type === 'childList' &&
          mutation.addedNodes &&
          mutation.addedNodes.length > 0 &&
          Array.prototype.filter.call(mutation.addedNodes, function(node) {
            return (
              node.classList &&
              (node.classList.contains('message') ||
                node.classList.contains('day_container'))
            );
          }).length > 0
        );
      });
    });

    var config = {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: true
    };
    observer.observe(target, config);

    var msgInputObserver = new MutationObserver(function(mutations) {
      mutations = mutations.filter(function(mutation) {
        return (
          (mutation.type === 'attributes' &&
            mutation.attributeName !== 'class') ||
          mutation.type === 'characterData'
        );
      });
      if (mutations.length > 0) {
        msgInputElement.onchange();
      }
    });

    // It takes some time for previous entered text to load
    setTimeout(function() {
      msgInputElement.onchange();
      msgInputObserver.observe(msgInputElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      });
    }, 1500);
  }
});

browser.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.slack != undefined) {
    browser.storage.local.get('slack', function(items) {
      if (items.slack == true || items.slack == undefined) {
        var RTL_CHARACTERS = '֑-߿‏‫‮יִ-﷽ﹰ-ﻼ';
        var RTL_REGEX = new RegExp(
          '^[^' + RTL_CHARACTERS + ']*?[' + RTL_CHARACTERS + ']'
        );

        var isRTL = function(str) {
          return RTL_REGEX.test(str);
        };

        var msgInputElement =
          document.querySelector('#msg_input .ql-editor') ||
          document.querySelector('#msg_input');

        var rtlifyInput = function(e) {
          if (isRTL(this.value || this.innerText)) {
            this.classList.add('rtl-input');
          } else {
            this.classList.remove('rtl-input');
          }
        }.bind(msgInputElement);

        // Minor timeout for when the paste event triggers before the text is available
        var timeoutRtlifyFunc = function() {
          setTimeout(rtlifyInput, 20);
        };
        msgInputElement.oninput = msgInputElement.onkeyup = msgInputElement.onpaste = msgInputElement.onchange = msgInputElement.onpropertychange = timeoutRtlifyFunc;
        var target = document.getElementById('msg_input');
        var observer = new MutationObserver(function(mutations) {
          mutations = mutations.filter(function(mutation) {
            return (
              mutation.type === 'childList' &&
              mutation.addedNodes &&
              mutation.addedNodes.length > 0 &&
              Array.prototype.filter.call(mutation.addedNodes, function(node) {
                return (
                  node.classList &&
                  (node.classList.contains('message') ||
                    node.classList.contains('day_container'))
                );
              }).length > 0
            );
          });
        });

        var config = {
          attributes: false,
          childList: true,
          characterData: false,
          subtree: true
        };
        observer.observe(target, config);

        var msgInputObserver = new MutationObserver(function(mutations) {
          mutations = mutations.filter(function(mutation) {
            return (
              (mutation.type === 'attributes' &&
                mutation.attributeName !== 'class') ||
              mutation.type === 'characterData'
            );
          });
          if (mutations.length > 0) {
            msgInputElement.onchange();
          }
        });

        // It takes some time for previous entered text to load
        setTimeout(function() {
          msgInputElement.onchange();
          msgInputObserver.observe(msgInputElement, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true
          });
        }, 1500);
      }
    });
  }
});
