'use strict';

var HtmlReporter = require('protractor-html-screenshot-reporter'),
  mkdirp = require('mkdirp');

exports.config = {
  seleniumServerJar: './node_modules/protractor/selenium/selenium-server-standalone-2.42.2.jar', // Make use you check the version in the folder

  multiCapabilities: [
    {
      browserName: 'chrome'
    },    
    {
      browserName: 'firefox'
    },
  ],
    
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    inclueStackTrace: true
  },
  
  onPrepare: function() {
    mkdirp.sync('reports/test/e2e/junit');
    mkdirp.sync('reports/test/e2e/html');

    jasmine.getEnv().addReporter(new HtmlReporter({
      baseDirectory: 'reports/test/e2e/html'
    }));

    require('jasmine-reporters');
    
    jasmine.getEnv().addReporter(new jasmine.JUnitXmlReporter('reports/test/e2e/junit', true, true));

    var ptor = protractor.getInstance();
    ptor.manage().timeouts().implicitlyWait(500);
    ptor.manage().deleteAllCookies();
    ptor.ignoreSynchronization = true;
  },
  
  params: {
    homeUrl: 'http://localhost:3000/'
  }
};