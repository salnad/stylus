process.env.BABEL_ENV = 'test'

require('@babel/register')({
  extensions: ['.js', '.ts']
})
