# UMass Class Crawler

## Demo

![demo](./demo.gif)

**UMass Class Crawler** crawls class data of University of Amherst Massachusetts by [Puppeteer](https://www.npmjs.com/package/puppeteer).

## Install

0. Node.js and NPM must be installed.

1. Download the zip file and extract it.

2. Open terminal and move to the directory where the zip file is extracted.

3. Install packages by typing the following on the command prompt.

```
npm install
```

## Start

1. Open terminal and move to the directory where the zip file is extracted.

2. Start the program by typing the following on the command prompt.

```
npm start
```

## Debug

It will execute Chromium without headless option.

```
npm run start:dev
```

## Result

The data of UMass classes will be saved in **data** directory. In **data** directory, a directory will be created
whose name is `Date.now()` value when the directory is created. Inside the directory, JSON files of each major and
each career will be created.
