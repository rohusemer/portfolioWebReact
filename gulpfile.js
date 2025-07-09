const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const watch = require('gulp-watch');

// Task to compile SASS to CSS
gulp.task('sass', function() {
  return gulp.src('src/scss/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('dist/css'));
});

// Task to minify CSS
gulp.task('minify-css', function() {
  return gulp.src('dist/css/*.css')
    .pipe(cleanCSS({
      compatibility: 'ie8'
    }))
    .pipe(gulp.dest('dist/css'));
});

// Task to minify JS
gulp.task('minify-js', function() {
  return gulp.src('src/js/**/*.js')
    .pipe(uglify())
    .pipe(gulp.dest('dist/js'));
});

// Watch task
gulp.task('watch', function() {
  gulp.watch('src/scss/**/*.scss', gulp.series('sass', 'minify-css'));
  gulp.watch('dist/css/*.css', gulp.series('minify-css'));
  gulp.watch('src/js/**/*.js', gulp.series('minify-js'));
});

// Default task
gulp.task('default', gulp.series('sass', 'minify-css', 'minify-js', 'watch'));