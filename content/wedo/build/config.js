var settings = {
  platform: 'win10desktop',
  useWebViewFormatAdorner: true,
  showComputational: true,
  useVerticalSlideshow: false,
  useConnectionCenter: true,
  showEGS: true,
  mediaSizes: {
    movie: {
      prefix: 'small.',
      suffix: '.mp4',
    },
    image: {
      prefix: 'high.',
      suffix: '.jpg',
    },
    slideshow: {
      prefix: 'high.',
      suffix: '.jpg',
    },
  },
  debug: false
};

// Internet explorer will allow us to access local files in the project IF we use this version of
// xmlHttpRequest instead of the standard one.
window.XMLHttpRequest = function(){
  var ax = new ActiveXObject('MSXML2.XMLHTTP');
  var o = {
    _ax: ax,
    _status: "fake",
    responseText: "",
    responseXml: null,
    readyState: 0,
    status: 0,
    statusText: 0,
    onreadystatechange: null,
    onload: null,
    onerror: null,
    onabort: null,
    ontimeout: null,
  };
  o._onreadystatechange = function() {
    var self = o;
    return function() {
      self.readyState   = self._ax.readyState;
      if (self.readyState == 4) {
        self.responseText = self._ax.responseText;
        self.responseXml  = self._ax.responseXml;
        self.status       = self._ax.status;
        self.statusText   = self._ax.statusText;
      } else {
        self.responseText = null;
        self.responseXml  = null;
        self.status       = 0;
        self.statusText   = 0;
      }
      if (self.onreadystatechange) self.onreadystatechange();
      if (self.readyState == 4) {
        // For some reason, successful requests for local files return status = 0. I can't find an
        // explanation for that. Failed requests return random values (such as missing file = 2)
        if (self.status == 200 || self.status == 304 || self.status == 0) {
          if (self.onload) self.onload();
        } else {
          if (self.onerror) self.onerror();
        }
      }
    }
  }();
  o.open = function(bstrMethod, bstrUrl, varAsync, bstrUser, bstrPassword) {
    varAsync = (varAsync !== false);
    this._ax.onreadystatechange = this._onreadystatechange;
    if (o.ontimeout) this._ax.ontimeout = o.ontimeout;
    return this._ax.open(bstrMethod, bstrUrl, varAsync, bstrUser, bstrPassword);
  };
  o.send = function(varBody) {
    return this._ax.send(varBody);
  };
  o.abort = function() {
    var res = this._ax.abort();
    if (o.onabort) o.onabort();
    return res;
  };
  o.setRequestHeader = function(bstrHeader, bstrValue) {
    this._ax.setRequestHeader(bstrHeader, bstrValue);
  };
  o.getAllResponseHeaders = function() {
    return this._ax.getAllResponseHeaders();
  };
  return o;
}