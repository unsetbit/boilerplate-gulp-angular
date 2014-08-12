'use strict';

// Utilities  
var  _ = require('lodash'),
  gutil = require('gulp-util'),
  es = require('event-stream'),
  watch = require('gulp-watch'),
  fs = require('fs'),
  path = require('path'),
  del = require('del'),
  source = require('vinyl-source-stream');

// Gulp Plugins
var sourcemaps = require('gulp-sourcemaps'),
  uglify = require('gulp-uglify'),
  concat = require('gulp-concat'),
  rename = require('gulp-rename'),
  less = require('gulp-less'),
  csso = require('gulp-csso'),
  jshint = require('gulp-jshint'),
  beautify = require('js-beautify'),
  recess = require('gulp-recess'),
  plato = require('gulp-plato'),
  connect = require('gulp-connect');

// Components without existing gulp plugins
var  browserify = require('browserify'),
  karma = require('karma').server,
  jsStylish = require('jshint-stylish');

// Angular-specific Modules
var ngAnnotate = require('gulp-ng-annotate'),
  templateCache = require('gulp-angular-templatecache'),
  protractor = require('gulp-protractor').protractor,
  webdriver_update = require('gulp-protractor').webdriver_update,
  webdriver_standalone = require('gulp-protractor').webdriver_standalone;

module.exports = function(gulp, options){
  //***************//
  // Configuration //
  //***************//
  
  options = options || {};

  var pkg = {};
  if(options.pkg !== undefined) pkg = options.pkg;

  // This will be used to name the generated files (<name>.js and <name>.css)
  var name = pkg.name;
  if(options.name !== undefined) name = options.name;

  // SOURCE DIRECTORIES
  // JavaScript source code and unit tests.
  var jsSrc = './src/**/*.js';
  if(options.jsSrc !== undefined) jsSrc = options.jsSrc;

  var unitTests = './src/**/*Spec.js';
  if(options.unitTests !== undefined) unitTests = options.unitTests; 

  var e2eTests = './test/**/*Spec.js';
  if(options.e2eTests !== undefined) e2eTests = options.e2eTests;

  // CSS source code.
  var cssSrc = './src/**/*.less';
  if(options.cssSrc !== undefined) cssSrc = options.cssSrc;

  var templates = './src/**/*.html';
  if(options.templates !== undefined) templates = options.templates;

  // ENTRY POINTS
  var jsMain = './src/main.js';
  var name = 'app';
  if(options.jsMain !== undefined){
    jsMain = options.jsMain;
    name = path.basename(jsMain, '.js');
  }

  if(options.name !== undefined) name = options.name;

  var cssMain;
  if(options.cssMain !== undefined) cssMain = options.cssMain;

  var cssDisabled = false;
  if(cssMain === undefined) cssDisabled = true;

  // GENERATED DIRECTORIES
  var buildDir = './build';
  if(options.buildDir !== undefined) buildDir = options.buildDir;

  var distDir = './dist';
  if(options.distDir !== undefined) distDir = options.distDir;

  var reportsDir = './reports';
  if(options.reportsDir !== undefined) reportsDir = options.reportsDir;

  // DEFAULT COMPONENT CONFIGURATIONS
  var jsBeautifyConfig = _.assign(require('./defaultJSBeautifyConfig'), options.jsBeautifyConfig);
  var jsHintConfig = _.assign(require('./defaultJSHintConfig'), options.jsHintConfig);
  var recessConfig = _.assign(require('./defaultRecessConfig'), options.recessConfig);
  var connectConfig = _.assign(require('./defaultConnectConfig'), options.connectConfig);
  var karmaConfig = _.assign(require('./defaultKarmaConfig'), options.karmaConfig);
  var protractorConfigFile = options.protractorConfigFile || path.resolve(__dirname, './defaultProtractorConfig');


  //*****************//
  // Local Variables //
  //*****************//
  var continuous = false;


  //*******************//
  // Convenience Tasks //
  //*******************//
  
  // The default task will run dist, which includes build, optimizations, tests, 
  // lints, and generates coverage reports.
  gulp.task('default', ['dist']);

  // Builds an uniminfied version of the CSS and JavaScript files with embedded
  // source maps.
  var buildTasks = ['js'];
  if(!cssDisabled) buildTasks.push('css');
  gulp.task('build', buildTasks);

  // Builds minified versions of the CSS and JavaScript files with external
  // source maps.
  var buildMinTasks = ['js-min'];
  if(!cssDisabled) buildMinTasks.push('css-min');
  
  gulp.task('build-min', buildMinTasks);


  //*******************//
  // Development Tasks //
  //*******************//
  // Wipe out all generated files which are generated via build tasks.
  gulp.task('clean', ['clean-reports', 'clean-dist', 'clean-build']);

  gulp.task('clean-reports', function(done){
    del([reportsDir], done);
  });

  gulp.task('clean-dist', function(done){
    del([distDir], done);
  });

  gulp.task('clean-build', function(done){
    del([buildDir], done);
  });

  // Incrementally build JavaScript and CSS files as they're modified and then
  // execute testing and linting tasks. Also starts a connect server which
  // reloads connected browsers whenever example or build dir changes contents.
  gulp.task('dev', ['example'], function() {
    continuous = true;
    
    gulp.watch([
      jsSrc,
      '!' + unitTests
    ], ['js']);

    gulp.watch([
      jsSrc,
      'gulpfile.js'
    ], ['js-lint']);

    if(!cssDisabled){
      gulp.watch(cssSrc, ['css', 'lint-css']);
    }

    var config = _.assign({},
      karmaConfig,
      {
        files: [
          __dirname + '/bower_components/angular/angular.js',
          __dirname + '/bower_components/angular-mocks/angular-mocks.js',
          buildDir + '/templates.js',
          jsSrc,
          unitTests
        ]
      });
    
    karma.start(config);
  });

  gulp.task('server', ['build'], function(){
    if(continuous) connectConfig.livereload = true;
    connect.server(connectConfig);
  });

  gulp.task('example', ['server'], function() {
    watch({
      glob: connectConfig.root.map(function(dir){ return dir + '/**/*'; })
    }).pipe(connect.reload());
  });


  // Creates a clean, full build with testing, linting, reporting and
  // minification then copies the results to the dist folder.
  gulp.task('dist', ['test', 'lint', 'reports', 'build-min'], 
    function() {
    return gulp.src([
        buildDir + '/**/*',
        '!' + buildDir + '/templates.js'
      ])
      .pipe(gulp.dest(distDir));
  });

  //*************************//
  // JavaScript Bundler Tasks //
  //*************************//
  // Generates a Template bundle of templatesDir.
  gulp.task('js-templates', ['clean-build'], function(){
    return gulp.src(templates)
      .pipe(templateCache({
        standalone: true,
        module: 'templates',
        sourcemap: true
      }))
      .pipe(gulp.dest(buildDir)); 
  });

  // Generates a JavaScript bundle of jsMain and its dependencies using
  // browserify in the build directory with an embedded sourcemap.
  gulp.task('js-scripts', ['clean-build'], function(){
    return browserify(jsMain)
      .bundle({
        debug: true,
        standalone: name
      })
      .pipe(source(path.basename(jsMain))) // gulpifies the browserify stream
      .pipe(rename(name + '.js'))
      .pipe(gulp.dest(buildDir));
  });

  gulp.task('js', ['js-scripts', 'js-templates'], function() {
    return gulp.src([buildDir + '/templates.js', buildDir + '/' + name + '.js'])
      .pipe(sourcemaps.init())
      .pipe(concat(name + '.js'))
      .pipe(sourcemaps.write())
      .pipe(gulp.dest(buildDir));
  });

  // Generates a minified JavaScript bundle in the build directory with an
  // accompanying source map file.
  gulp.task('js-min', ['js', 'clean-dist'], function() {
    return gulp.src(buildDir + '/' + name + '.js')
      .pipe(ngAnnotate({add:true, single_quotes: true}))
      .pipe(sourcemaps.init())
      .pipe(uglify())
      .pipe(rename(name + '.min.js'))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(buildDir));
  });


  //*******************//
  // CSS Bundler Tasks //
  //*******************//

  // Deletes generated CSS files (and source maps) from the build directory.
  gulp.task('clean-css', function(cb) {
    del([buildDir + '/**/*.css{,map}'], cb);
  });

  // Generates a CSS bundle of cssMain and its dependencies using LESS
  // in the build directory with an embedded source map.
  gulp.task('css', ['clean-build'], function() {
    return gulp.src(cssMain)
      .pipe(sourcemaps.init())
      .pipe(less())
      .pipe(rename(name + '.css'))
      .pipe(sourcemaps.write())
      .pipe(gulp.dest(buildDir));
  });

  // Generates a minified CSS bundle in the build directory with an accompanying
  // source map.
  gulp.task('css-min', ['css', 'clean-dist'], function() {
    return gulp.src(buildDir + '/' + name + '.css')
      .pipe(rename(name + '.min.css'))
      .pipe(sourcemaps.init())
      .pipe(csso())
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(buildDir));
  });


  //*******************//
  // Quality Assurance //
  //*******************//

  // Generates test coverage and code maintainabilty reports.
  gulp.task('reports', ['test', 'plato']);

  gulp.task('test', ['unit-test', 'e2e-test']);

  gulp.task('webdriver-update', webdriver_update);
  gulp.task('webdriver-start', ['webdriver-update'], webdriver_standalone);

  gulp.task('e2e-test', ['server', 'webdriver-update'], function(){
    return gulp.src([e2eTests])
      .pipe(protractor({
        configFile: protractorConfigFile
    })).on('error', function(){ 
      connect.serverClose();
    }).on('close', function(){ 
      connect.serverClose();
    });
  });

  gulp.task('unit-test', ['js'], function(done){
    var config = _.assign({},
      karmaConfig,
      {
        files: [
          __dirname + '/bower_components/angular/angular.js',
          __dirname + '/bower_components/angular-mocks/angular-mocks.js',
          buildDir + '/templates.js',
          jsSrc,
          unitTests
        ],
        singleRun: true,
        autoWatch: false,
      });

    config.coverageReporter.reporters.push({ type: 'text', dir: 'reports/test/unit/coverage' });

    karma.start(config, done);
  });

  // Generates a maintainability report using Plato.
  gulp.task('plato', function(done){
    return gulp.src([
      jsSrc,
      '!' + unitTests // exclude tests
    ]).pipe(plato(reportsDir + '/plato', { 
        jshint: {
          options: jsHintConfig
        }
      }));
  });

  // Runs the JavaScript sources files through JSHint according to the options
  // set in jsHintConfig, and the CSS source files through Recess according to
  // the options set in recessConfig.
  var lintTasks = ['js-lint'];
  if(!cssDisabled) lintTasks.push('css-lint');
  gulp.task('lint', lintTasks);

  // Runs the JavaScript source files via JSHint according to the options set in
  // jsHintConfig.
  gulp.task('js-lint', function() {
    var config = jsHintConfig;

    var pipe = gulp.src([
        jsSrc,
        unitTests,
        e2eTests,
        'gulpfile.js'
      ])
      .pipe(jshint(jsHintConfig))
      .pipe(jshint.reporter(jsStylish));

    if (!continuous){
      pipe = pipe.pipe(jshint.reporter('fail'));
    }

    return pipe;
  });

  // Runs the LESS source files via recess according to the options set in
  // recessConfig.
  gulp.task('css-lint', function() {
    return gulp.src(cssSrc)
      .pipe(recess(recessConfig));
  });

  // *REWRITES* This project's JavaScript files, passing them through JS 
  // Beautifier with the options in jsBeautifyConfig
  gulp.task('fix-style', function() {
    return gulp.src([
        jsSrc,
        unitTests,
        e2eTests,
        'gulpfile.js'
      ])
      .pipe(es.map(function(file, cb) {
        try {
          file.contents = new Buffer(
            beautify(String(file.contents), jsBeautifyConfig)
          );
          fs.writeFile(file.path, file.contents, function() {
            cb(null, file);
          });
        } catch (err) {
          return cb(new gutil.PluginError(
            'fix-style', 
            err, 
            jsBeautifyConfig
          ));
        }
      }));
  });
};