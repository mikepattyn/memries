export async function installWindows(deps) {
  if (!deps.nodeOk()) {
    deps.log('Installing Node.js LTS via winget (OpenJS.NodeJS.LTS)…');
    deps.wingetInstall('OpenJS.NodeJS.LTS');
  } else {
    deps.log(`Node ${deps.nodeVersion()} already satisfies >=20`);
  }
  if (!deps.goFound()) {
    deps.log('Installing Go via winget (GoLang.Go)…');
    deps.wingetInstall('GoLang.Go', ['--no-upgrade']);
  } else {
    deps.log(`Go already installed (${deps.goVersion()}); skipping install and update`);
  }
}
