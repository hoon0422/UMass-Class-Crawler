const cheerio = require('cheerio');
const waitForWheel = require('./wait');

/**
 * The instance has a page, an instance of Puppeteer Page class, which searches one major and one career.
 * At a page of search result and of details of classes, it crawls and returns data of UMass classes.
 *
 * @class SearchResultPage
 */
class SearchResultPage {
  /**
   *Creates an instance of SearchResultPage.
   * @param {*} page an instance of Puppeteer Page class.
   * @memberof SearchResultPage
   */
  constructor(page) {
    if (page.url() !== process.env.SEARCH_PAGE) {
      throw new Error('URL of SearchResultPage must be ' + process.env.SEARCH_PAGE);
    }
    this.page = page;
  }

  /**
   * Initialize page. The page must show the reuslt page of searching UMass classes before initialization.
   * @memberof SearchResultPage
   */
  async init() {
    const titleText = await this.page.$eval('#win0divDERIVED_CLSRCH_SSR_CLASS_LBLlbl span', e => e.textContent);
    if (titleText !== 'Search Results') {
      throw new Error('Page of SearchResultPage must show the result of search');
    }

    this.sectionBtns = await this.page.$$eval('.PSHYPERLINKACTIVE', sections => 
      sections.filter((_, idx) => {
        return idx % 2 === 1;
      }).map(s => s.id.split('$').join('\\$'))
    );
  }

  /**
   * Crawls data of the result page of searching UMass courses.
   * @param {*} html HTML source of the result page.
   * @returns Data of UMass courses.
   * @memberof SearchResultPage
   */
  crawlCourses(html) {
    const $ = cheerio.load(html);
    const coursesData = [];

    let courseData, temp;
    for (let i = 0; $('#DERIVED_CLSRCH_DESCR200\\$' + i).length != 0; i++) {
      courseData = {};

      // course number, course title
      temp = $('#DERIVED_CLSRCH_DESCR200\\$' + i).text().trim().replace(/\s\s+/g, ' ');
      courseData.number = temp.substr(0, temp.indexOf('-') - 1).replace(/\s\s+/g, ' ');
      courseData.title = temp.substr(temp.indexOf('-') + 2).replace(/\s\s+/g, ' ');

      courseData.sections = [];
      coursesData.push(courseData);
    }

    return coursesData;
  }

  /**
   * Crawls data of the detail page of each UMass section.
   * @param {*} html HTML source of the detail page.
   * @returns Data of a UMass section.
   * @memberof SearchResultPage
   */
  crawlSection(html) {
    const $ = cheerio.load(html);
    const classData = { model: 'Section' };
    let temp;
  
    // course number
    temp = $('#DERIVED_CLSRCH_DESCR200').text().trim().replace(/\s\s+/g, ' ');
    classData.courseNumber = temp.substr(0, temp.indexOf('-') - 1).trim().replace(/\s\s+/g, ' ');
    

    // class category
    temp = $('#DERIVED_CLSRCH_SSS_PAGE_KEYDESCR').text();
    classData.category = temp.substr(temp.lastIndexOf('|') + 2).trim().replace(/\s\s+/g, ' ');

    // number
    classData.number = $('#SSR_CLS_DTL_WRK_CLASS_NBR').text().trim().replace(/\s\s+/g, ' ');

    // units
    temp = $('#SSR_CLS_DTL_WRK_UNITS_RANGE').text();
    if (temp.includes('-')) {
      classData.minUnit = parseFloat(temp.substr(0, temp.indexOf('-')).trim().replace(/\s\s+/g, ' '));
      classData.maxUnit = parseFloat(temp.substr(temp.indexOf('-') + 1).trim().replace(/\s\s+/g, ' '));
    } else {
      classData.minUnit = parseFloat(temp.trim().replace(/\s\s+/g, ' '));
      classData.maxUnit = classData.minUnit;
    }

    // class components
    classData.components = [];
    for (let i = 0; $('#SSR_CLS_DTL_WRK_DESC\\$' + i).length != 0 ; i++) {
      classData.components.push($('#SSR_CLS_DTL_WRK_DESCR\\$' + i).text().trim().replace(/\s\s+/g, ' '));
    }

    // career
    classData.career = $('#PSXLATITEM_XLATLONGNAME\\$33\\$').text().trim().replace(/\s\s+/g, ' ');

    // room / time / online
    temp = $('#MTG_LOC\\$0').text().trim().replace(/\s\s+/g, ' ');
    if (temp === 'On-Line') {
      classData.online = true;
    } else {
      classData.online = false;
      classData.room = temp;
      classData.time = $('#MTG_SCHED\\$0').text().trim().replace(/\s\s+/g, ' ');
    }

    // professor
    temp = $('#MTG_INSTR\\$0').text().trim().replace(/\s\s+/g, ' ');
    classData.professors = temp.split(',').map(s => s.trim().replace(/\s\s+/g, ' '));

    return classData;
  }

  /**
   * Crawls a result page of searching a major and a career.
   * The page is on the result page of searching, so the major and the career are already specified.
   * This function clicks buttons for a detail page of UMass section, and crawls data.
   * After this function finishes execution, the return value will be saved in a property
   * of the instance.
   * @returns Data of UMass courses and sections of a major and a career.
   * @memberof SearchResultPage
   */
  async search() {
    this.searchResult = null;

    // crawl data of UMass courses
    const coursesData = this.crawlCourses(await this.page.content());
    const sectionsData = [];

    // click each buttons for section and crwal data.
    for (let sectionBtn of this.sectionBtns) {
      console.log(`Search: ${sectionBtn}`);
      await this.page.waitForSelector(`#${sectionBtn}`);
      await this.page.click(`#${sectionBtn}`);

      await waitForWheel(this.page);
      await this.page.waitForSelector('#CLASS_SRCH_WRK2_SSR_PB_BACK\\$154\\$');
      sectionsData.push(this.crawlSection(await this.page.content()));

      // return to the result page.
      await this.page.click(`#CLASS_SRCH_WRK2_SSR_PB_BACK`);
      console.log(`Search Done: ${sectionBtn}`);

      await waitForWheel(this.page);
    }

    // After finishing the search, go back to search page.
    await this.page.waitForSelector(`#CLASS_SRCH_WRK2_SSR_PB_NEW_SEARCH`);
    await this.page.click(`#CLASS_SRCH_WRK2_SSR_PB_NEW_SEARCH`);
    await waitForWheel(this.page);

    // Combine course data and section data. Two data will be matched by a course number field.
    let course;
    for (let section of sectionsData) {
      course = coursesData.find((course) => course.number === section.courseNumber);
      course.sections.push(section);
      delete section.courseNumber; // After matching, course number data in section does not need anymore.
    }

    this.searchResult = coursesData;
    return coursesData;
  }
}
module.exports = SearchResultPage;
