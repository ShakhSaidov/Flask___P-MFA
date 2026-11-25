export async function requestJson(url, options = {}) {
  let resp;
  try {
    resp = await fetch(url, options);
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("The request timed out waiting for the server. Please try again.");
    }
    throw new Error("Could not reach the server. Check that Flask is running.");
  }

  let data = {};
  try {
    data = await resp.json();
  } catch {
    data = {};
  }

  if (!resp.ok) {
    if (resp.status >= 500 && !data.error) {
      throw new Error("Could not reach the server. Check that Flask is running.");
    }
    throw new Error(data.error || `Request failed (HTTP ${resp.status}).`);
  }

  return data;
}