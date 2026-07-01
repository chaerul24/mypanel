module.exports = {
  apps: [
    {
      name: "mypanel",
      cwd: "/media/chaerul/panel-data/www/mypanel",
      script: "server.cjs",
      env: {
        PORT: 5591,
        NODE_ENV: "production",
      },
    },
  ],
}
