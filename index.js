require('dotenv').config();
const browser = new (require('./browser'));

(async () => {
  await browser.initSearch();
  
  const majors = browser.majors;
  const careers = browser.careers;
  
  await browser.search(majors, careers);

  await browser.close();
})();
