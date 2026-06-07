(function (global) {
  "use strict";

  var DEFAULTS = {
    id: "loadingArea",
    dogSpriteSrc: "トイプーシルエット-removebg-preview.png",
    message: "読み込み中",
  };

  function buildMarkup(options) {
    var dogSrc = options.dogSpriteSrc;
    return (
      '<div class="loading-dogs" aria-hidden="true">' +
        '<div class="loading-dogs__track"></div>' +
        '<div class="loading-dogs__orbit">' +
          '<span class="loading-dogs__marker loading-dogs__marker--white">' +
            '<img class="loading-dogs__sprite" src="' + dogSrc + '" alt="" width="120" height="90" decoding="async" />' +
            '<span class="loading-dogs__eye-dot" aria-hidden="true"></span>' +
          "</span>" +
          '<span class="loading-dogs__marker loading-dogs__marker--black">' +
            '<img class="loading-dogs__sprite" src="' + dogSrc + '" alt="" width="120" height="90" decoding="async" />' +
            '<span class="loading-dogs__eye-dot" aria-hidden="true"></span>' +
          "</span>" +
        "</div>" +
      "</div>" +
      '<span class="visually-hidden">' + options.message + "</span>"
    );
  }

  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === "string") {
      return document.querySelector(target) || document.getElementById(target);
    }
    return target;
  }

  function mount(target, options) {
    var el = resolveElement(target);
    if (!el) return null;

    var config = Object.assign({}, DEFAULTS, options || {});
    if (config.id) el.id = config.id;
    el.className = "loading-panel";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = buildMarkup(config);
    el.dataset.loadingPanelMounted = "";
    return el;
  }

  function show(target) {
    var el = resolveElement(target);
    if (el) el.style.display = "flex";
    return el;
  }

  function hide(target) {
    var el = resolveElement(target);
    if (el) el.style.display = "none";
    return el;
  }

  global.LoadingPanel = {
    mount: mount,
    show: show,
    hide: hide,
  };

  document.querySelectorAll("[data-loading-panel]:not([data-loading-panel-mounted])").forEach(function (el) {
    mount(el, { id: el.id || DEFAULTS.id });
  });
})(window);
