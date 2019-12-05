import { stringify, parse, extract } from "query-string";

export function getUrls() {
  return {};
}

export function getLocation() {
  const { location = {} } = window;
  return location;
}

// Turn a query string into an Object
export function parseQueryParams(queryString = undefined) {
  const _queryString = queryString || extract(getLocation().href);
  return parse(_queryString);
}

export function getPathname() {
  const { pathname = "" } = getLocation();
  return pathname;
}

export function getUrlPath() {
  // Examines the window.locatiom.path value and
  // trims out unwanted characters and formats it for tracking.
  return (
    getPathname()
      .replace(/.html/, "")
      .replace(/\//, "") || "index"
  );
}

// Make a payload url friendly and filter our bad object values.
export function serialize(queryParams, encode = false) {
  // Removes Null/Undefined values from the queryString.
  const filteredQueryParams = Object.keys(queryParams).reduce((params, key) => {
    const value = queryParams[key];
    /* eslint-disable */
    !value || value === "null" || value === "undefined"
      ? (params[key] = undefined)
      : (params[key] = value);
    /* eslint-enable */
    return params;
  }, {});
  return stringify(filteredQueryParams, {
    sort: false,
    encode
  });
}
