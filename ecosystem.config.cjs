/**
 * PM2, sous l'utilisateur « achats ».
 *
 * Le VPS héberge aussi le CRM HM Group, dont le process PM2 vit sous
 * l'utilisateur « ubuntu », dans un démon séparé. Ce fichier ne décrit que
 * l'outil Achats : un seul process, un seul port, ses propres journaux.
 */
module.exports = {
  apps: [
    {
      name: "achats-filiales",
      // Le serveur applique les migrations au démarrage, puis sert l'API et
      // l'interface compilée sur la même origine.
      script: "backend/server.js",
      cwd: "/home/achats/app",
      instances: 1,
      // « fork » et non « cluster » : les sessions vivent en base, mais un
      // seul process suffit largement ici, et le journal reste lisible.
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // Redémarre si une fuite s'installe, sans attendre qu'OVH s'en mêle.
      max_memory_restart: "400M",
      // Une boucle de redémarrage ne doit pas s'emballer en silence.
      min_uptime: "20s",
      max_restarts: 10,
      error_file: "/home/achats/logs/erreur.log",
      out_file: "/home/achats/logs/sortie.log",
      merge_logs: true,
      time: true,
    },
  ],
};
