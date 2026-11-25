export async function requestJson(url, options = {}) {
  let resp;
  try {
    resp = await fetch(url, options);
  } catch {
    throw new Error("Could not reach the server. Check that Flask is running.");
  }

  let data = {};
  try {
    data = await resp.json();
  } catch {
    data = {};
  }

  if (!resp.ok) {
    throw new Error(data.error || `Request failed (HTTP ${resp.status}).`);
  }

  return data;
}
