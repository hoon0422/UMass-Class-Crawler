const waitForWheel = async (page) => {
  await page.waitForFunction(`document.getElementById('WAIT_win0').style.visibility === "hidden"`);
};
module.exports = waitForWheel;
