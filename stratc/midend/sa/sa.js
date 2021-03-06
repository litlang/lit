const ArchiveBuilder = require('../../../util/archiveBuilder');

module.exports = deps => async (ir, filename) => {
  if (filename === undefined) {
    return ir;
  }
  const targetName = `${deps.fs.path.basename(filename, '.st')}.sa`;
  await deps.fs.writeFile(targetName, await buildSysArchive(deps, ir.hosts));
  return undefined;
};

async function buildSysArchive (deps, hosts) {
  await loadArtifacts(deps, hosts);
  const archive = new ArchiveBuilder();
  (hosts || {})
    .values()
    .forEach(host => {
      (host.artifacts || []).forEach(artifact => {
        const fileName = artifact.absolutePath
          ? deps.fs.path.basename(artifact.absolutePath)
          : `data${artifact.media}`;
        const saPath = `${artifact.name}/${fileName}`;
        archive.addDataAsFile(
          artifact.data,
          saPath);
        artifact.saPath = saPath;
      });
    });

  //Mutating the artifacts within the loop above can cause bugs
  // because some artifacts are referenced in more than one host
  // (like the reflect functions for example)
  (hosts || {})
    .values()
    .flatmap(host => host.artifacts)
    .forEach(artifact => {
      delete artifact.data;
      delete artifact.declaredFile;
      delete artifact.type;
      delete artifact.token;
      delete artifact.absolutePath;
    });

  archive.addDataAsFile(Buffer.from(JSON.stringify(hosts)), 'hosts.json');

  return archive.data();
}

async function loadArtifacts (deps, hosts) {
  await Promise.all(hosts.values().map(async host => {
    return Promise.all(host.artifacts.map(async artifact => {
      return loadArtifact(deps, artifact);
    }));
  }));
}

async function loadArtifact (deps, artifact) {
  const cat = artifact.type === 'file'
    ? deps.fs.cat
    : artifact.type === 'url'
      ? deps.internet.cat
      : async () => artifact.token.value;

  try {
    artifact.data = await cat(artifact.absolutePath);  
  } catch (e) {
    throw {
      stratCode: 'E_INVALID_ARTIFACT',
      message: `Failed to load file ${artifact.absolutePath}: ${e.message}`,
      file: artifact.declaredFile,
      line: artifact.token.line
    }
  }
}
