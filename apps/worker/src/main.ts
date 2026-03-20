const workerBootstrapMessage = {
  service: "worker",
  status: "bootstrapped",
  note: "Import worker skeleton is ready for ingestion stories."
};

console.log(JSON.stringify(workerBootstrapMessage));
