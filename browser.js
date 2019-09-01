const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const waitForWheel = require('./wait');
const SearchResultPage = require('./page');

// functions for array product(cartesian product)
const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);

/**
 * The instance has a Puppeteer chrome browser. The browser is used to crawl UMass class data.
 * @class SearchBrowser
 */
class SearchBrowser {
  /**
   * Creates an instance of SearchBrowser.
   * @memberof SearchBrowser
   */
  constructor() {
    this.initialized = false; // Whether the browser of the instance is initialized for search.
    this.date = Date.now(); // Date will used for the name of a directory containing crawled data.
  }

  /**
   * Initialize the browser for search.
   * @memberof SearchBrowser
   */
  async initSearch() {
    try {
      this.browser = await puppeteer.launch({ headless: process.env.NODE_ENV === 'production' });
      this.pageForSession = await this.browser.newPage();

      await this.pageForSession.goto(process.env.LOGIN_PAGE);
      await this.pageForSession.click('a[name=CourseCatalogLink]');

      await this.pageForSession.goto(process.env.SEARCH_PAGE);

      this.majors = await this.pageForSession.$$eval('#CLASS_SRCH_WRK2_SUBJECT\\$108\\$ option',
        optionTags => optionTags.map(optionTag => optionTag.getAttribute('value').trim().replace(/\s\s+/g, ' '))
      );
      this.majors = this.majors.slice(1);

      this.careers = await this.pageForSession.$$eval('#CLASS_SRCH_WRK2_ACAD_CAREER option',
        optionTags => optionTags.map(optionTag => optionTag.getAttribute('value').trim().replace(/\s\s+/g, ' '))
      );
      this.careers = this.careers.slice(1);

      this.initialized = true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Tells if there is an error on search.
   * If an element whose id is "DERIVED_CLSMSG_ERROR_TEXT" exists, there must be an error.
   * @param {*} page Page class of Puppeteer whose url is on the search page.
   * @returns True if there is on error, otherwise false.
   * @memberof SearchBrowser
   */
  async isErrorOnSearch(page) {
    return (await page.$('#DERIVED_CLSMSG_ERROR_TEXT')) !== null;
  }

  /**
   * Search UMass classes of the majors and the careers.
   * It searches after selecting each major and the careers.
   * @param {*} majors Array of option tag values of majors.
   * @param {*} careers Array of option tag values of careers.
   * @memberof SearchBrowser
   */
  async search(majors, careers) {
    if (!this.initialized) {
      throw new Error('Browser is not initialized for search.');
    }

    if (!majors) {
      majors = this.majors.slice();
    }

    if (!careers) {
      careers = this.careers.slice();
    }

    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'));
    }

    if (!fs.existsSync(path.join(__dirname, `data/${this.date}`))) {
      fs.mkdirSync(path.join(__dirname, `data/${this.date}`));
    }

    try {
      const page = await this.browser.newPage();
      await page.goto(process.env.SEARCH_PAGE);

      const majorXcareer = cartesian(majors, careers);

      let m, c, p, sr;
      for (let mc of majorXcareer) {
        [m, c] = mc;

        // set search options
        await page.waitForSelector('#CLASS_SRCH_WRK2_SSR_PB_CLEAR');
        await page.click('#CLASS_SRCH_WRK2_SSR_PB_CLEAR');
        await waitForWheel(page);

        await page.$eval(
          `option[value="${m}"]`,
          option => { option.setAttribute('selected', 'selected') }
        );
        await page.$eval(
          `option[value="${c}"]`,
          option => { option.setAttribute('selected', 'selected') }
        );

        console.log(`Major: ${m} // Career: ${c}`);
        await page.waitForSelector('#CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH');
        await page.click('#CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH');
        await waitForWheel(page);

        if (await this.isErrorOnSearch(page)) {
          continue;
        }

        await page.waitForSelector('#CLASS_SRCH_WRK2_SSR_PB_NEW_SEARCH\\$62\\$');

        // search and save
        p = new SearchResultPage(page);

        try {
          await p.init();
          sr = await p.search();
          fs.writeFileSync(path.join(__dirname, `data/${this.date}/${m}__${c}.json`), JSON.stringify(sr));
        } catch (err) {
          console.error(err);
          await page.goto(process.env.SEARCH_PAGE);
          continue;
        }
      }

      await page.close();
    } catch (err) {
      throw err;
    }
  }

  /**
   * Close the browser. After this method executed, the instance cannot be reused.
   * @memberof SearchBrowser
   */
  async close() {
    this.browser.close();
  }
}

module.exports = SearchBrowser;
