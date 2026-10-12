// The one source of the performance-measuring recipe (TEC-020). Used by measure-fps.mjs and measure-startup.mjs.

export const PHONE = {
  name: "phone",
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  cpuThrottle: 4,
};
export const DESKTOP = {
  name: "desktop",
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  cpuThrottle: 1,
};
/** M0's recipe, Chrome/Lighthouse "slow 4G": 1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT (CDP wants bytes/s). */
export const SLOW_4G = { latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 };

/** A fresh context + page for `profile`: HTTP cache disabled, CPU throttled by profile.cpuThrottle, network throttled if `network` is given. Caller closes `context`. */
export async function openPage(browser, profile, network = null) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (network) await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuThrottle });
  return { context, page };
}
