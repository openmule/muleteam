module.exports = {
  apps: [
    {
      name: "muleteam-web",
      script: "npm",
      args: "start",
      cwd: "/root/muleteam",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
