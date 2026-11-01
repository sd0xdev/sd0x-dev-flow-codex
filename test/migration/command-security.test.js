'use strict';

const {
  assert,
  fs,
  path,
  execFileSync,
  test,
  auditCandidate,
  auditCandidateStatic,
  commit,
  git,
  copy,
  fixtureRoot,
  withAuthorizationBlock,
  prepareRow,
  writeCandidate
} = require('../helpers/migration-context');

test('read-listed Git commands classify writes and reject external helpers', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default',
    body: 'Use the [guide](references/guide.md), then run `git status`.'
  });
  const skillPath = path.join(values.root, relative, 'SKILL.md');
  const skill = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(skillPath, skill.replace('git status', 'git diff --output=result.patch'));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /undeclared operation: local-write/);
  fs.writeFileSync(skillPath, skill.replace('git status', "git diff --out'put'=result.patch"));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /undeclared operation: local-write/);
  fs.writeFileSync(skillPath, skill.replace('git status', "git grep --open-files-in-'pager'=vim pattern"));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /unsupported Git helper option/);
  const connectorWriteCommands = new Set([
    'npm install example-package',
    'npm i example-package',
    'npm rm example-package',
    'npm test',
    'npm version patch',
    'npm create example-app',
    'npm init example-app',
    'npx example-package',
    'pip install example-package',
    'pip download example-package',
    'pip wheel example-package',
    'cargo fix',
    'cargo b',
    'cargo c',
    'cargo test',
    'composer require example-package',
    'go get example-package',
    'dotnet restore',
    'dotnet tool install example-package',
    'dotnet workload install example-package',
    'pnpm fetch',
    'poetry sync',
    'pipx inject example-package dependency',
    'npm link example-package',
    'npm prune',
    'gem i example-package',
    'poetry build',
    'composer config --editor',
    'composer config -e',
    'composer config -ge',
    'npm config edit',
    'npm fund lodash --browser=true',
    'npm help folders',
    'cargo help metadata',
    'dotnet help new',
    'brew info --github wget',
    'brew reinstall example-package',
    'yarn',
    'yarn --immutable',
    'yarn fixture-script',
    'pnpm fixture-script'
  ]);
  for (const command of [
    'time -o result git status',
    'time --output=result git status',
    'command time -o result git status',
    'exec -ca harmless time -o result git status',
    "t''ime -o result git status",
    'ti\\me -o result git status',
    "command t''ime -o result git status",
    'env time -o result git status',
    'env -u FOO time --output=result git status',
    'env -iu FOO time -o result git status',
    'timeout 10 time -o result git status',
    'timeout -vk 1 10 time -o result git status',
    'sudo time -o result git status',
    'sudo -u root time -o result git status',
    'setsid time -o result git status',
    'stdbuf -oL time -o result git status',
    'chroot / time -o result git status',
    'xargs time -o result git status',
    'xargs -rn 1 time -o result git status',
    'flock /tmp/lock git status',
    'flock /tmp/lock time -o result git status',
    "flock /tmp/lock -c 'time -o result git status'",
    "flock -nw 1 /tmp/lock -c 'time -o result git status'",
    'parallel --results result git status ::: branch',
    'parallel --joblog=jobs.log git status ::: branch',
    'parallel --record-env',
    'parallel --record-e',
    'parallel --cat echo ::: branch',
    'setx SAFE value',
    'del /f result.txt',
    'Remove-Item result.txt',
    'Rename-Item old.txt new.txt',
    'ac result.txt value',
    'ni result.txt',
    'ri result.txt',
    'sp result.txt Value data',
    'Export-Csv -Path result.csv',
    'Export-Clixml -Path result.xml',
    'reg add HKCU\\Software\\Example /v Value /d data /f',
    'reg export HKCU\\Software\\Example result.reg /y',
    'npm install example-package',
    'npm i example-package',
    'npm rm example-package',
    'npm test',
    'npm version patch',
    'npm create example-app',
    'npm init example-app',
    'npx example-package',
    'pip install example-package',
    'pip download example-package',
    'pip wheel example-package',
    'cargo fix',
    'cargo b',
    'cargo c',
    'cargo test',
    'composer require example-package',
    'go get example-package',
    'dotnet restore',
    'dotnet tool install example-package',
    'dotnet workload install example-package',
    'pnpm fetch',
    'poetry sync',
    'pipx inject example-package dependency',
    'npm link example-package',
    'npm prune',
    'gem i example-package',
    'poetry build',
    'poetry config virtualenvs.create false',
    'pip config unset global.index-url',
    'npm config edit',
    'brew reinstall example-package',
    'yarn',
    'yarn --immutable',
    'yarn fixture-script',
    'pnpm fixture-script',
    'curl -o result.json https://example.test/data',
    'curl -oresult.json https://example.test/data',
    'curl -sLoresult.json https://example.test/data',
    'curl -D headers.txt https://example.test/data',
    "curl -s -w '%output{result.txt}ok' data:,x",
    'curl -c cookies.txt https://example.test/data',
    'curl --etag-save etag.txt https://example.test/data',
    'wget https://example.test/archive.zip',
    'tar -xf archive.tar',
    'tar xf archive.tar',
    'tar --append -f archive.tar result.txt',
    'tar uf archive.tar result.txt',
    'unzip archive.zip',
    'zip -T -TT true archive.zip input.txt',
    'iwr https://example.test/data -OutFile result.json',
    'parallel -j 2 time -o result git status ::: branch',
    'watch time -o result git status',
    'watch -s shots git status',
    'watch --shotsdir=shots git status',
    'watch -dq 2 time -o result git status',
    'watch -dn 1 time -o result git status',
    'runner time -o result git status',
    "runner 'time -o result git status'",
    "rg --pre 'time -o result' pattern .",
    "rg --pr 'time -o result' pattern .",
    'sudo -nu root time -o result git status',
    'time -vo result git status',
    '/usr/bin/time -o result git status',
    'sort -o result.txt input.txt',
    'sort --out=result.txt input.txt',
    'uniq input.txt output.txt',
    'uniq - output.txt',
    'uniq -- -input.txt -output.txt',
    'tar --index-file=index.txt -cf archive.tar result.txt',
    'tar --index-f=index.txt -tf archive.tar',
    'tar --volno-file=volume.txt -tf archive.tar',
    'tar --volno-f=volume.txt -tf archive.tar'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git status', command));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), connectorWriteCommands.has(command)
      ? /undeclared operation: connector-write/
      : /undeclared operation: (?:connector-write|local-write)/, command);
  }
  for (const language of [
    'ash', 'bat', 'batch', 'cmd', 'csh', 'dash', 'fish', 'ksh', 'powershell', 'ps1', 'pwsh',
    'tcsh', 'yash'
  ]) {
    fs.writeFileSync(skillPath,
      `${skill}\n\`\`\`${language}\ngit diff --output=result.patch\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: local-write/, language);
  }
  for (const command of [
    'del /f result.txt',
    'ac result.txt value',
    'Rename-Item old.txt new.txt',
    'reg add HKCU\\Software\\Example /v Value /d data /f',
    'curl -o result.json https://example.test/data',
    'tar -xf archive.tar'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n${command}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: local-write/, command);
  }
  for (const command of [
    'parallel --sql pg:///jobs echo ::: branch',
    'parallel --transferfile input -S host echo ::: branch',
    'setx /S host SAFE value',
    'copy result.txt \\\\host\\share\\result.txt',
    'Copy-Item result.txt -ToSession $session -Destination result.txt',
    'Copy-Item result.txt -To $session -Destination result.txt',
    'curl -F file=@result.txt https://example.test/upload',
    'curl -Ffile=@result.txt https://example.test/upload',
    'curl -sFfile=@result.txt https://example.test/upload',
    'curl -K transfer.conf https://example.test/data',
    'wget --config=transfer.conf https://example.test/data',
    'wget -e post_data=value https://example.test/data',
    'tar -I helper-program -cf archive.tar result.txt',
    'tar -cvIhelper-program archive.tar result.txt',
    'tar cvI helper-program archive.tar result.txt',
    'tar --to-command=helper-program -xf archive.tar',
    'tar -F helper-program -cf archive.tar result.txt',
    'tar -cvF helper-program archive.tar result.txt',
    'tar cvF helper-program archive.tar result.txt',
    'tar -tf host.example:archive.tar',
    'tar -tf host.example:archive.tar -- --force-local',
    'custom-tool mutate-state',
    'powershell -File external-script.ps1',
    'iwr https://example.test/api -Method POST -Body data',
    'iwr https://example.test/api -Method "POST"',
    'iwr https://example.test/api -Me POST',
    'iwr https://example.test/api -Bo value',
    'iwr https://example.test/api -Fo @{value=1}',
    "iwr https://example.test/api -Headers @{'X-HTTP-Method-Override'='DELETE'}",
    "iwr https://example.test/api -Headers @{'X-HTTP-Method'='DELETE'}",
    'iwr https://example.test/api -Headers:$headers',
    'Start-BitsTransfer -Tr Upload -Source result.txt -Destination https://example.test/upload',
    "iwr https://example.test/api -Method P''OST",
    'iwr https://example.test/api -Method $method',
    'curl --request=POST https://example.test/api',
    'curl -H "X-HTTP-Method-Override: DELETE" https://example.test/api',
    'curl -H "X-HTTP-Method: DELETE" https://example.test/api',
    'wget --header="X-Method-Override: PATCH" https://example.test/api',
    "curl --request=P''OST https://example.test/api",
    'curl -X$method https://example.test/api',
    "curl --d''ata=value https://example.test/api",
    "curl -''F file=@result.txt https://example.test/api",
    "curl -Q 'DELE result.txt' ftp://example.test/",
    'wget --method=POST https://example.test/api',
    'wget --meth=POST https://example.test/api',
    "wget --method=P''OST https://example.test/api",
    "wget --post-''data=value https://example.test/api",
    'wget --post-d=value https://example.test/api',
    'npm publish',
    'npm audit fix',
    'npm fund lodash --browser=true',
    'npm help folders',
    'cargo help metadata',
    'dotnet help new',
    'brew info --github wget',
    'npm config edit',
    'composer config --editor',
    'composer config -e',
    'composer config -ge',
    'cargo publish',
    'cargo check',
    'cargo b',
    'cargo c',
    'gem push package.gem',
    'dotnet nuget push package.nupkg',
    'npm adduser',
    'gem signin',
    'npm install example-package',
    'yarn build',
    'yarn npm tag add latest 1.2.3',
    'curl https://example.test/api -Body value'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git status', command));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: connector-write/, command);
  }
  for (const line of [
    '- custom-tool mutate-state',
    '- customtool mutate-state',
    '- **customtool mutate-state**',
    '- `customtool`',
    '- `customtool` — execute the command',
    'use custom-tool mutate-state',
    'use customtool mutate-state',
    'use "customtool" mutate-state',
    'use "Custom Tool" argument',
    'use "customtool" argument.',
    'use customtool argument.',
    'use frobnicate argument.'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n${line}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: connector-write/, line);
  }
  for (const command of [
    'TAR_OPTIONS=--to-command=helper-program tar -tf archive.tar',
    'export TAR_OPTIONS=--info-script=helper-program; tar -tf archive.tar',
    'TAPE=host.example:archive.tar tar -tf',
    'export TAPE=host.example:archive.tar; tar -tf'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git status', command));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported Git shell environment mutation/, command);
  }
  prepareRow(values.root, 'architecture', { operations: ['connector-write', 'read'] });
  fs.writeFileSync(skillPath, skill.replace(
    'git status', 'parallel --return result echo ::: branch'
  ));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /undeclared operation: local-write/);
  for (const command of [
    'parallel --sql sqlite:///jobs.db echo ::: branch',
    'parallel --sqlm=csv:///jobs/table echo ::: branch',
    'parallel --sql sql:sqlite3:///jobs.db echo ::: branch',
    'parallel --sqlm=sql:csv:///jobs/table echo ::: branch',
    'parallel --sql +sqlite:///jobs.db echo ::: branch',
    'parallel --sqlm=+sql:csv:///jobs/table echo ::: branch'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git status', command));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: local-write/, command);
  }
  for (const command of [
    'echo time -o result; git status',
    "printf '%s\\n' time -o result; git status",
    "rg 'time -o result' README.md",
    'git diff -Oorderfile'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git status', command));
    assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
      true);
  }
  prepareRow(values.root, 'architecture', { operations: ['local-write', 'read'] });
  for (const command of [
    'tar cf archive.tar host.example:member.txt',
    'tar --force-local -tf host.example:archive.tar',
    'tar --force-l -tf host.example:archive.tar'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git status', command));
    assert.equal(auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }).ok, true, command);
  }

  fs.writeFileSync(skillPath, `${skill}\nRead \`scripts/read.js\`.\n`);
  const scripts = path.join(values.root, relative, 'scripts');
  fs.mkdirSync(scripts);
  fs.writeFileSync(path.join(scripts, 'read.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['diff', '--ext-diff']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /unsupported Git helper option/);
  fs.writeFileSync(path.join(scripts, 'read.js'), [
    "const { execSync } = require('node:child_process');",
    "execSync('git grep --open-files-in-pager=less pattern');",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /unsupported Git helper option/);
  for (const command of [
    "execFileSync('git', ['grep', '-Ovim', 'pattern']);",
    "execFileSync('git', ['grep', '-O', 'vim', 'pattern']);",
    "execFileSync('git', ['grep', '--open-files-in-p', 'vim', 'pattern']);"
  ]) {
    fs.writeFileSync(path.join(scripts, 'read.js'), [
      "const { execFileSync } = require('node:child_process');",
      command,
      ''
    ].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported Git helper option/);
  }
});

test('fragmented shell executable spellings fail closed', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default',
    body: 'Use the [guide](references/guide.md).'
  });
  const skillPath = path.join(values.root, relative, 'SKILL.md');
  const skill = fs.readFileSync(skillPath, 'utf8');
  for (const command of [
    "g''it push origin main",
    "g'i't push origin main",
    'g\\it push origin main',
    "$'git' push origin main",
    '"git" push origin main',
    '$GIT push origin main',
    '${GIT:-git} push origin main',
    'g${EMPTY}it push origin main',
    '$(printf git) push origin main',
    '$GIT grep -Ovim pattern',
    "$(printf '\\x67\\x69\\x74') push origin main",
    "$'\\x67\\x69\\x74' push origin main",
    '${A:-g}${B:-it} push origin main',
    '$(printf g)it push origin main',
    'g$(printf i)t push origin main',
    'alias g=git; g push origin main',
    "`printf g`it push origin main",
    'command g$(printf i)t push origin main',
    'env g$(printf i)t push origin main',
    "command $(printf '\\x67\\x69\\x74') push origin main",
    "exec $(printf '\\x67\\x69\\x74') push origin main",
    'g(){ git "$@"; }; g push origin main',
    'function g { git "$@"; }; g push origin main',
    'hash -p /usr/bin/git g; g push origin main',
    'time g$(printf i)t push origin main',
    'nohup g$(printf i)t push origin main',
    'x=1 g\'\'it push origin main',
    'nice -n 5 g$(printf i)t push origin main',
    'timeout 5 g$(printf i)t push origin main',
    'g(){ g$(printf i)t "$@"; }; g push origin main',
    'function g {\n command git "$@"\n}\ng push origin main',
    'hash -p /usr/bin/g\'\'it g; g push origin main',
    'time nohup g$(printf i)t push origin main',
    'sh -c \'g$(printf i)t push origin main\'',
    'eval g$(printf i)t push origin main',
    'env -P /usr/bin g\'\'it push origin main',
    'env -S \'g\'\'it push origin main\'',
    'command time -o /tmp/t g\'\'it push origin main',
    'git status & g\'\'it push origin main',
    'printf x | g\'\'it push origin main',
    '(g\'\'it push origin main)',
    '! g\'\'it push origin main',
    'sh -lc \'g\'\'it push origin main\'',
    'sh -ce \'g$(printf i)t push origin main\'',
    'sh -o posix -c \'g$(printf i)t push origin main\'',
    'bash -O extglob -c \'g$(printf i)t push origin main\'',
    'exec -a harmless g$(printf i)t push origin main',
    '{ g\'\'it push origin main; }',
    'if false; then :; else g$(printf i)t push origin main; fi',
    'while true; do g$(printf i)t push origin main; break; done',
    'coproc g\'\'it push origin main',
    'gi\\\nt push origin main',
    'g\\\ni\\\nt push origin main',
    "g''\\\nit push origin main",
    "printf '%s' '$(literal'; g''it push origin main",
    "printf x | xargs g''it push origin main",
    "printf x | xargs g''it pu''sh origin main",
    "sudo g''it push origin main",
    "find . -maxdepth 0 -exec g''it push origin main ';'",
    "dash -c 'g$(printf i)t push origin main'",
    "csh -c 'g`printf i`t push origin main'",
    "bash --rcfile /dev/null -c \"g''it pu''sh origin main\"",
    "sudo sh -c \"g''it pu''sh origin main\"",
    "sudo env xargs g''it pu''sh origin main",
    "setsid sudo sh -c \"g''it pu''sh origin main\"",
    "flock /tmp/lock g''it pu''sh origin main",
    "parallel g''it pu''sh origin main ::: branch",
    "runner g''it pu''sh origin main",
    "rg --pre g''it pattern .",
    "rg --pr g''it pattern .",
    "sort --compress-p g''it input",
    "daemon g''it pu''sh origin main",
    "daemonize g''it pu''sh origin main",
    "start-stop-daemon --start --exec g''it -- pu''sh origin main",
    "systemd-run g''it pu''sh origin main",
    "watch g''it pu''sh origin main",
    "fish -c 'g$(printf i)t push origin main'",
    "fish -C \"g''it pu''sh origin main\"",
    "fish --init-command=\"g''it pu''sh origin main\"",
    "yash -c 'g$(printf i)t push origin main'",
    "trap 'g$(printf i)t push origin main' DEBUG; :",
    "echo ok # \\\ng''it pu''sh origin main",
    'Apply this: `g$(printf i)t push origin main`.'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`bash\n${command}\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /fragmented Git\/GitHub executable/, command);
  }
  for (const language of [
    'ash', 'csh', 'dash', 'fish', 'ksh', 'powershell', 'ps1', 'pwsh', 'tcsh', 'yash'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`${language}\ng''it pu''sh origin main\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /fragmented Git\/GitHub executable/, language);
  }
  for (const [language, command] of [
    ['powershell', "& ('g' + 'it') push origin main"],
    ['pwsh', "Invoke-Expression ('g' + 'it' + ' push origin main')"],
    ['ps1', "Start-Process git -ArgumentList 'push origin main'"],
    ['powershell', "Set-Alias g git; g push origin main"],
    ['ps1', "New-Item Alias:g -Value git; g push origin main"],
    ['pwsh', 'function g { git @args }; g push origin main'],
    ['powershell', '. ./commands.ps1; g push origin main'],
    ['ps1', 'Import-Module ./commands.psm1; g push origin main'],
    ['pwsh', "pwsh -Command 'git push origin main'"],
    ['powershell', '[System.Diagnostics.Process]::Start("git", "push origin main")'],
    ['pwsh', 'New-Object System.Diagnostics.ProcessStartInfo'],
    ['ps1', 'New-Object -ComObject WScript.Shell'],
    ['powershell', "[type]::GetTypeFromProgID('WScript.Shell')"],
    ['pwsh', 'Invoke-CimMethod -ClassName Win32_Process -MethodName Create'],
    ['powershell', 'Invoke-WmiMethod -Class Win32_Process -Name Create'],
    ['pwsh', '& $command'],
    ['powershell', '. $command']
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`${language}\n${command}\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported PowerShell expression invocation/, `${language}: ${command}`);
  }
  for (const [language, command] of [
    ['pwsh', '$env:HOME = "C:\\temp"'],
    ['ps1', 'Set-Item Env:RIPGREP_CONFIG_PATH rg.conf'],
    ['powershell', 'Set-Content Env:HOME C:\\temp'],
    ['pwsh', 'Add-Content Env:PATH C:\\tools'],
    ['ps1', 'si Env:HOME C:\\temp'],
    ['powershell', 'ac Env:PATH C:\\tools'],
    ['pwsh', 'ri Env:HOME'],
    ['powershell', '[Environment]::SetEnvironmentVariable("HOME", "C:\\temp")']
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`${language}\n${command}\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported Git shell environment mutation/, `${language}: ${command}`);
  }
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`pwsh\nWrite-Host "safe & literal"\ngit status\n\`\`\`\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  for (const command of [
    "& ('g' + 'it') push origin main",
    "Invoke-Expression ('g' + 'it' + ' push origin main')",
    '[System.Diagnostics.Process]::Start("git", "push origin main")',
    'New-Object -ComObject WScript.Shell',
    'Set-Alias g git; g push origin main',
    'New-Item Alias:g -Value git; g push origin main'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\nRun \`${command}\`.\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported PowerShell expression invocation/, command);
  }
  for (const command of [
    'Set-Alias g git; g push origin main',
    'New-Item Alias:g -Value git; g push origin main'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n${command}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported PowerShell expression invocation/, command);
  }
  fs.writeFileSync(skillPath,
    `${skill}\n> \`\`\`bash\n> g''it pu''sh origin main\n> \`\`\`\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /fragmented Git\/GitHub executable/);
  for (const language of ['bat', 'batch', 'cmd']) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`${language}\ngit push origin main\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: push/, language);
  }
  for (const command of [
    'g^it push origin main',
    '%GIT% push origin main',
    '!GIT! push origin main',
    '%GIT% p^ush origin main',
    '%GIT% %OP% origin main',
    'g^\nit push origin main',
    'g^\r\nit push origin main',
    'cmd /c g^\nit push origin main',
    'cmd /c g^\r\nit push origin main',
    'g%EMPTY%it push origin main',
    'for %G in (git) do %G push origin main',
    'doskey g=git & g push origin main',
    'cmd /c git push origin main',
    'call git push origin main',
    'start "" git push origin main',
    'powershell -Command "git push origin main"',
    "for /f %G in ('echo git') do %G push origin main"
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`cmd\n${command}\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported Windows command dynamic invocation/, command);
  }
  for (const command of [
    'set HOME=C:\\temp & git push origin main',
    'set "HOME=C:\\temp" & git push origin main',
    'set /A HOME=1',
    'set /P HOME=prompt',
    'set/A HO^ME=1',
    'path C:\\evil',
    'set HO^ME=C:\\temp',
    'set H%EMPTY%OME=C:\\temp',
    'set %ENV_NAME%=C:\\temp',
    'setx /M PA^TH C:\\tools',
    'setx RIPGREP_CONFIG_PATH rg.conf & rg pattern .'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n\`\`\`cmd\n${command}\n\`\`\`\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported (?:Git shell environment mutation|Windows command dynamic invocation)/,
    command);
  }
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`cmd\necho "%TEMP%"\ngit status\n\`\`\`\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  for (const command of [
    'Run `cmd /c git push origin main`.',
    'Run `call %GIT% %OP% origin main`.',
    'Run `%GIT% push origin main`.',
    'Run `g^it push origin main`.',
    'g^it push origin main',
    'g%EMPTY%it push origin main',
    'cmd /c git push origin main'
  ]) {
    fs.writeFileSync(skillPath, `${skill}\n${command}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported Windows command dynamic invocation/, command);
  }
  fs.writeFileSync(skillPath, `${skill}\nRun \`git grep '\${HOME}'\`.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, `${skill}\nRun \`git grep g''it\`.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`bash\nf() { echo ok; }; git status\nf() { echo "git status"; }; git status\nhash -p /usr/bin/node node; git status\nprintf '%s\\n' '$('\n\`\`\`\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`bash\nf(){ : ${'x'.repeat(2100)}; g$(printf i)t push origin main; }; f\n\`\`\`\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`bash\nfunction g {\n  # }\n  command git "$@"\n}\ng push origin main\n\`\`\`\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`bash\nhash -p/usr/bin/g''it g; g push origin main\n\`\`\`\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
  fs.writeFileSync(skillPath, `${skill}\nApply this: \`g$(printf i)t diff --output=result.patch\`.\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
  fs.writeFileSync(skillPath, `${skill}\nUse this: \`command env HOME=/tmp g''it status\`.\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
  fs.writeFileSync(skillPath, `${skill}\nUse this: \`g''it pu''sh origin main\`.\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
  fs.writeFileSync(skillPath, `${skill}\n\`\`\`bash\necho x \\\\\ng''it push origin main\n\`\`\`\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /fragmented Git\/GitHub executable/);
});

test('Git push and GitHub reads reject external executable helpers', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture', { operations: ['push', 'read'] });
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default',
    sensitiveOperations: ['push'],
    body: 'Use the [guide](references/guide.md), then run `git push origin main`.'
  });
  const skillPath = path.join(values.root, relative, 'SKILL.md');
  const skill = fs.readFileSync(skillPath, 'utf8');
  for (const command of [
    'gh pr view -- --web',
    'gh pr view --template -w'
  ]) {
    fs.writeFileSync(skillPath, `${withAuthorizationBlock(skill.replace(
      'git push origin main', command
    ))}\nThen run git push origin main.\n`);
    assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
      true, command);
  }
  for (const command of [
    "git push --receive-pack='python3 /tmp/payload.py' origin main",
    "git push 'ext::python3 /tmp/payload.py' main",
    'git push --repo=ext::helper main',
    "git push --repo='ext::helper' main",
    'git push "$remote" main',
    'git push {ext,foo}::helper main',
    'git push <(/tmp/payload) main',
    'git push --repo=<(/tmp/payload) main',
    'git push =(/tmp/payload) main',
    'git push pwn://payload main',
    'git push --repo=pwn://payload main'
  ]) {
    fs.writeFileSync(skillPath, withAuthorizationBlock(skill.replace('git push origin main', command)));
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /(?:unsupported Git (?:executable override|external remote helper)|dynamic Git remote|unsupported shell command or process substitution)/);
  }
  fs.writeFileSync(skillPath, skill.replace('git push origin main', 'gh pr view --web'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported GitHub external-launch option/);
  fs.writeFileSync(skillPath, skill.replace('git push origin main', 'gh repo view -w'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported GitHub external-launch option/);
  for (const command of [
    'gh pr view --web=true',
    'gh pr view -w=true',
    'gh pr view -t=plain -w'
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git push origin main', () => command));
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /unsupported GitHub external-launch option/);
  }
  fs.writeFileSync(skillPath, skill.replace('git push origin main', 'gh pr view -wc'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported GitHub external-launch option/);
  fs.writeFileSync(skillPath, `${withAuthorizationBlock(skill.replace(
    'git push origin main', 'gh pr view -qworkflow --json title'
  ))}\nThen run git push origin main.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, `${withAuthorizationBlock(skill.replace(
    'git push origin main', 'gh pr view -Rwork/repo'
  ))}\nThen run git push origin main.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, `${withAuthorizationBlock(skill.replace(
    'git push origin main', 'gh pr view -cqworkflow --json title'
  ))}\nThen run git push origin main.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  for (const command of [
    'git push git+ssh://host/repo main',
    'git push ssh+git://host/repo main'
  ]) {
    fs.writeFileSync(skillPath, withAuthorizationBlock(skill.replace(
      'git push origin main', command
    )));
    assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
      true);
  }
  for (const command of [
    "git push '$remote' main",
    "git push 'repo`name' main"
  ]) {
    fs.writeFileSync(skillPath, withAuthorizationBlock(skill.replace(
      'git push origin main', command
    )));
    assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
      true);
  }
  for (const command of [
    "git push 'repo[1]' main",
    "git push 'repo{a}' main"
  ]) {
    fs.writeFileSync(skillPath, withAuthorizationBlock(skill.replace(
      'git push origin main', command
    )));
    assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
      true);
  }
  for (const command of [
    "git diff --$'output'=result.patch",
    'git grep --$(printf open-files-in-pager)=vim',
    "git push --repo=$'ext::pwn'",
    "gh pr view --$'web'"
  ]) {
    fs.writeFileSync(skillPath, skill.replace('git push origin main', () => command));
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /(?:unsupported dynamic|dynamic Git remote|unsupported shell command or process substitution)/);
  }
  fs.writeFileSync(skillPath, `${skill.replace(
    'git push origin main', 'git status'
  )}\n\`\`\`bash\ngit diff --\`printf output\`=result.patch\n\`\`\`\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /(?:unsupported dynamic Git option|unsupported shell command or process substitution)/);
  for (const command of [
    'git show `/tmp/payload`',
    'gh pr view `/tmp/payload`'
  ]) {
    fs.writeFileSync(skillPath, `${skill.replace(
      'git push origin main', 'git status'
    )}\n\`\`\`bash\n${command}\n\`\`\`\n`);
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /unsupported shell command or process substitution/);
  }
  fs.writeFileSync(skillPath, `${withAuthorizationBlock(skill.replace(
    'git push origin main', "git log --grep='$HOME'"
  ))}\nThen run git push origin main.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, `${withAuthorizationBlock(skill.replace(
    'git push origin main', "gh pr view --jq='$ARGS.named.web'"
  ))}\nThen run git push origin main.\n`);
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(skillPath, skill.replace('git push origin main', "gh pr view --we'b'"));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported GitHub external-launch option/);
});

test('standalone GitHub and Git version probes remain read-only', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default',
    body: 'Use the [guide](references/guide.md). Run `git --version`. Then run `gh --version`.'
  });
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }).ok, true);
});

test('mutation audit handles argv subprocesses, dynamic commands, negation, and alternate executables', (t) => {
  const auditCandidate = auditCandidateStatic;
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default',
    body: 'Use the [guide](references/guide.md). Never run `git push`; instead run `git push origin main`.'
  });
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: push/);
  const skillPath = path.join(values.root, relative, 'SKILL.md');
  fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8').replace(
    'Never run `git push`; instead run `git push origin main`.',
    'Never run `git push`.'
  ));
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  const prohibitedOnly = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n1. git push origin main\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: push/);
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n2) gh pr create\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: pr-write/);
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n1. [ ] git push origin main\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: push/);
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n- **gh pr create**\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: pr-write/);
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n- **gh pr create** — open the PR\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: pr-write/);
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n1. **git push origin main** after review\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: push/);
  for (const line of [
    '- *gh pr create* — open the PR',
    '1. _git push origin main_ after review',
    '- ***gh pr create***'
  ]) {
    fs.writeFileSync(skillPath, `${prohibitedOnly}\n${line}\n`);
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /undeclared operation: (?:push|pr-write)/);
  }
  fs.writeFileSync(skillPath, prohibitedOnly.replace(
    'Never run `git push`.',
    'Do not run `git push` without approval.'
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: push/);
  fs.writeFileSync(skillPath,
    `${prohibitedOnly}\nInspect the git repository. Do not run git clean.\nUse scores > 10 for the high-risk bucket.\nUse \`coverage > 80%\` as threshold.\n\`score > 10\`\n\n> **Note**: Use --limit 30.\n\n- The score is > 10.\n- coverage > 80% is required.\n- \`coverage > 80%\` is required.\n- \`coverage > 80%\`\n- \`coverage.rate > 0.8\`\n- \`scores[0] > threshold\`\n- \`score + bonus > 10\`\n- \`score - penalty > 10\`\n- \`flags & mask > 0\`\n- \`coverage.rate * 100 > 80\`\n- \`typeof value > threshold\`\n- \`typeof value > \"number\"\`\n- \`value ?? fallback > threshold\`\n- \`condition ? score : fallback > 10\`\n- \`max(a, b) > threshold\`\n- \`await getValue() > threshold\`\n1. \`score > 10\` selects the bucket.\n1. \`score > 10\`\n- \`A -> B\`\n- \`State A -> State B\`\n1. State transition A -> B.\n\n\`\`\`bash\nif [[ \"$actual\" > \"$expected\" ]]; then\n  echo ok\nfi\nif (( actual > expected )); then\n  echo ok\nfi\necho \"$((actual > expected))\"\n\`\`\`\n\n\`\`\`\nscore > 10\nscore > threshold\n\`\`\`\n\n    score > 10\n    score > threshold\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: connector-write/);
  fs.writeFileSync(skillPath, `${prohibitedOnly}\nRun git clean.\n`);
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported git subcommand: clean/);
  for (const command of [
    'echo x > file',
    'echo x>file',
    'echo x 1>file',
    'cmd 2>>log',
    'cat <<EOF',
    '1. echo x > file',
    '- echo x > file'
  ]) {
    fs.writeFileSync(skillPath, `${prohibitedOnly}\nRun \`${command}\`.\n`);
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /undeclared operation: (?:connector-write|local-write)/);
  }
  for (const line of [
    'Run `python3 build.py > artifact.txt`.',
    'Run `date > timestamp.txt`.',
    'Run `python3 > artifact.txt`.',
    'Use python > artifact.txt',
    '- python report.py > report.txt',
    '- $ python > report.txt',
    '- `python > report.txt`',
    '- `python > report.txt` then inspect the report.',
    '- `python > report`',
    '- deno run build.ts > report.txt',
    '- `dotnet test > report`',
    '- ruby report.rb > report.txt',
    '- cargo test > result.log'
  ]) {
    fs.writeFileSync(skillPath, `${prohibitedOnly}\n${line}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported shell executable/);
  }
  for (const block of [
    '```\necho x > file\n```',
    '    echo x > file',
    '```bash\n[[ -n "$(echo x > file)" ]]\n```',
    '```bash\n[[ -n "$(printf \'%s\' \'(x)\' > file)" ]]\n```',
    '```bash\n[[ -s <(echo x > file) ]]\n```'
  ]) {
    fs.writeFileSync(skillPath, `${prohibitedOnly}\n${block}\n`);
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /undeclared operation: local-write/);
  }
  fs.writeFileSync(skillPath, `${prohibitedOnly}\n[Override](references/override.txt)\n`);
  fs.writeFileSync(path.join(values.root, relative, 'references', 'override.txt'),
    'echo x > file\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: local-write/);
  fs.rmSync(path.join(values.root, relative, 'references', 'override.txt'));
  for (const line of [
    '1. echo x > file',
    '- echo x > file',
    '- ECHO x > file',
    '- ./WRITE_REPORT > file',
    '- `python report.py`',
    '- PYTHON report.py',
    'Use PYTHON report.py',
    "- Py'th'on report.py",
    '- Py$THON report.py',
    '- Tool+Plus report',
    '- ~/Bin/Tool report',
    '- Run `CustomTool`',
    '- Run `CustomTool argument`',
    '- Run `CustomScript argument`',
    '- Run `CustomScript deploy production`',
    '- Run `customtool argument`',
    '- a/tool report',
    'Use a/tool report'
  ]) {
    fs.writeFileSync(skillPath, `${prohibitedOnly}\n${line}\n`);
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
      /(?:undeclared operation: (?:connector-write|local-write)|fragmented Git\/GitHub executable text)/,
      line);
  }
  for (const line of [
    '- use concise language for the summary.',
    '- inspect the migration progress before continuing.',
    '- "$5/month" per user for the service.',
    '- $5/month per user for the service.',
    '- "Roadmap" describes the next release.',
    '- C++ is the implementation language.',
    '- C++17 is the implementation language.',
    '- concise -- option markers clarify the explanation.',
    '- `Roadmap` describes the next release.',
    '- Roadmap describes progress',
    '- API provides context',
    '- "Roadmap" for planning',
    '- concise language',
    '- npm provides package metadata',
    '- customtool provides context',
    '- npm accelerates package workflows',
    '- TypeScript improves type safety',
    '- TypeScript enables strict checks',
    '- VBScript enables legacy automation',
    '- VBScript deprecated',
    '- VBScript automation',
    '- CustomScript status production',
    '- stool enables seating',
    '- DevTool enables automation',
    '- power-tool enables repairs',
    '- CoffeeScript improves readability',
    '- ECMAScript defines the language standard',
    '- LiveScript is a programming language',
    '- manuscript improves clarity',
    '- shell-script describes an implementation style',
    '- concise guide.txt examples improve the explanation.',
    '- state-of-the-art guidance supports long-term maintenance.'
  ]) {
    fs.writeFileSync(skillPath, `${prohibitedOnly}\n${line}\n`);
    assert.doesNotThrow(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), line);
  }
  fs.writeFileSync(skillPath, prohibitedOnly.replace(
    'Never run `git push`.',
    'Run `git --git-dir=repo/.git commit`.'
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: commit/);
  fs.writeFileSync(skillPath, prohibitedOnly);

  const scripts = path.join(values.root, relative, 'scripts');
  fs.mkdirSync(scripts);
  fs.writeFileSync(path.join(scripts, 'write.js'),
    "require('node:fs').promises.writeFile('x', 'y');\n");
  fs.appendFileSync(skillPath, '\nRead `scripts/write.js`.\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: local-write/);
  for (const expression of [
    "fs.openSync('x', 'w')",
    "fs.createWriteStream('x')",
    "fs.truncateSync('x', 0)",
    "fs.chmodSync('x', 0o600)",
    "fs.linkSync('x', 'y')",
    "fs.symlinkSync('x', 'y')"
  ]) {
    fs.writeFileSync(path.join(scripts, 'write.js'), [
      "const fs = require('node:fs');",
      `${expression};`,
      ''
    ].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /undeclared operation: local-write/);
  }
  fs.writeFileSync(path.join(scripts, 'write.js'), [
    "const fs = require('node:fs');",
    'let descriptor;',
    'descriptor = fs.openSync(source, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));',
    'fs.fstatSync(descriptor);',
    'fs.closeSync(descriptor);',
    ''
  ].join('\n'));
  assert.doesNotThrow(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }));
  for (const code of [
    "const fs = require('node:fs');\nfs?.openSync('x', 'w');\n",
    "const fs = require('node:fs');\nconst second = (fs);\nsecond.openSync('x', 'w');\n",
    "const fs = require('node:fs');\nfunction mutate(io) { io.openSync('x', 'w'); }\nmutate(fs);\n",
    "const fs = require('node:fs');\nconst holder = { fs };\nholder.fs.openSync('x', 'w');\n"
  ]) {
    fs.writeFileSync(path.join(scripts, 'write.js'), code);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /node:fs namespace must only appear in direct audited member access/);
  }
  fs.writeFileSync(path.join(scripts, 'write.js'),
    "const fsp = require('node:fs/promises');\nfsp.writeFile('x', 'y');\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /node:fs\/promises imports are unsupported/);
  for (const code of [
    "require('node:inspector').open(9229);\n",
    "require('node:inspector')['open'](9229);\n",
    "require('node:inspector').open?.(9229);\n",
    "require('node:inspector').open.call(null, 0);\n",
    "require('node:inspector').open.bind(null)(0);\n",
    "require('node:inspector').open['call'](null, 0);\n",
    "const inspector = require('node:inspector'); inspector.open(9229);\n",
    "const noop = 0, inspector = require('node:inspector'); inspector.open(0);\n",
    "const source = require('node:inspector'); const { ...copy } = source; copy.open(0);\n",
    "const source = require('node:inspector'); const copy = { ...source }; copy.open(0);\n",
    "const source = require('node:inspector'); const copy = source; copy.open(0);\n",
    "const source = require('node:inspector'); const copy = Object.assign({}, source); copy.open(0);\n",
    "let source; source ||= require('node:inspector'); const copy = source; copy.open(0);\n",
    "let source; source &&= require('node:inspector'); const copy = source; copy.open(0);\n",
    "let source; source ??= require('node:inspector'); const copy = source; copy.open(0);\n",
    "const source = (require('node:inspector')); source.open(0);\n",
    "const source = true ? require('node:inspector') : null; source.open(0);\n",
    "let source; const alias = source = require('node:inspector'); alias.open(0);\n",
    "let source; const alias = (source = require('node:inspector')); alias.open(0);\n",
    "let alias, source; alias ||= source = require('node:inspector'); alias.open(0);\n",
    "let alias, source; alias &&= source = require('node:inspector'); alias.open(0);\n",
    "let alias, source; alias ??= source = require('node:inspector'); alias.open(0);\n",
    "import('node:inspector').then((inspector) => inspector.open(0));\n",
    "// benign\rconst inspector = require('node:inspector'); inspector.open(0);\n",
    "// benign\u2028const inspector = require('node:inspector'); inspector.open(0);\n",
    "const inspector = require('node:inspector'); inspector['open'](9229);\n",
    "const inspector = require('node:inspector'); const open = inspector['open']; open(9229);\n",
    "const inspector = require('node:inspector'); const launch = inspector[/* member */ 'open']; launch(0);\n",
    "const open = require('node:inspector')['open']; open(9229);\n",
    "const open = require('node:inspector')?.open; open(9229);\n",
    "let open; open = require('node:inspector')['open']; open(9229);\n",
    "let launch; launch ||= require('node:inspector').open; launch(0);\n",
    "let inspector; (inspector = require('node:inspector')); inspector.open(0);\n",
    "let inspector; const alias = inspector = require('node:inspector'); inspector.open(0);\n",
    "const launch = true ? require('node:inspector').open : null; launch(0);\n",
    "const open = require('node:inspector').open; (open)(0);\n",
    "const { open: listen } = require('node:inspector'); listen(9229);\n",
    "const {\n  open: launch\n} = require('node:inspector'); launch(9229);\n",
    "const { open: launch } = (require('node:inspector')); launch(9229);\n",
    "if (true) { const { open: launch } = require('node:inspector'); launch(9229); }\n",
    "const { 'open': launch } = (require('node:inspector')); launch(9229);\n",
    "const { 'op\\u0065n': launch } = require('node:inspector'); launch(9229);\n",
    "const { 'op\\145n': launch } = require('node:inspector'); launch(9229);\n",
    "const noop = 0, { open: launch } = require('node:inspector'); launch(0);\n",
    "const { open } = require('node:inspector'); const listen = open; listen(9229);\n",
    "let launch; ({ open: launch } = require('node:inspector')); launch(0);\n",
    "const noop = 0, open = require('node:inspector').open; open(0);\n",
    "require('node:sqlite'); database.loadExtension('/tmp/evil.so');\n"
  ]) {
    fs.writeFileSync(path.join(scripts, 'write.js'), code);
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /undeclared operation: connector-write|sensitive module (?:namespace|require shape|dynamic imports|quoted names)|escaped JavaScript property keys/, code);
  }
  for (const code of [
    "require('node:module').enableCompileCache('cache');\n",
    "require('node:module')['enableCompileCache']('cache');\n",
    "require('node:module')[('enableCompileCache')]('cache');\n",
    "const mod = require('node:module'); mod.enableCompileCache('cache');\n",
    "const { enableCompileCache: enable } = require('node:module'); enable('cache');\n",
    "require('node:module').flushCompileCache();\n",
    "require('node:trace_events').createTracing({ categories: ['node'] }).enable();\n",
    "const trace = require('node:trace_events'); trace.createTracing({ categories: ['node'] }).enable();\n",
    "require('node:trace_events')['createTracing']({ categories: ['node'] }).enable();\n",
    "const repl = require('node:repl').start({ terminal: false }); repl.setupHistory('history', () => repl.close());\n",
    "require('node:v8').writeHeapSnapshot('heap.heapsnapshot');\n",
    "const v8 = require('node:v8'); v8.writeHeapSnapshot('heap.heapsnapshot');\n",
    "const { writeHeapSnapshot: snapshot } = require('node:v8'); snapshot('heap.heapsnapshot');\n",
    "new (require('node:sqlite').DatabaseSync)('state.db');\n",
    "new (require('node:sqlite')['DatabaseSync'])('x.db');\n",
    "const sqlite = require('node:sqlite'); new sqlite.DatabaseSync('state.db');\n",
    "const noop = 0, sqlite = require('node:sqlite'); new sqlite.DatabaseSync('probe.db');\n",
    "const source = require('node:sqlite'); const { ...copy } = source; new copy.DatabaseSync('probe.db');\n",
    "const source = require('node:sqlite'); const copy = { ...source }; new copy.DatabaseSync('probe.db');\n",
    "const source = require('node:sqlite'); const copy = source; new copy.DatabaseSync('probe.db');\n",
    "const source = require('node:sqlite'); const copy = Object.assign({}, source); new copy.DatabaseSync('probe.db');\n",
    "let source; source ||= require('node:sqlite'); const copy = source; new copy.DatabaseSync('probe.db');\n",
    "let source; source &&= require('node:sqlite'); const copy = source; new copy.DatabaseSync('probe.db');\n",
    "let source; source ??= require('node:sqlite'); const copy = source; new copy.DatabaseSync('probe.db');\n",
    "const source = (require('node:sqlite')); new source.DatabaseSync('probe.db');\n",
    "const source = true ? require('node:sqlite') : null; new source.DatabaseSync('probe.db');\n",
    "let source; const alias = source = require('node:sqlite'); new alias.DatabaseSync('probe.db');\n",
    "let source; const alias = (source = require('node:sqlite')); new alias.DatabaseSync('probe.db');\n",
    "let alias, source; alias ||= source = require('node:sqlite'); new alias.DatabaseSync('probe.db');\n",
    "let alias, source; alias &&= source = require('node:sqlite'); new alias.DatabaseSync('probe.db');\n",
    "let alias, source; alias ??= source = require('node:sqlite'); new alias.DatabaseSync('probe.db');\n",
    "import('node:sqlite').then((sqlite) => new sqlite.DatabaseSync('probe.db'));\n",
    "// benign\u2029const sqlite = require('node:sqlite'); new sqlite.DatabaseSync('probe.db');\n",
    "const sqlite = require('node:sqlite'); new sqlite['DatabaseSync']('state.db');\n",
    "const sqlite = require('node:sqlite'); const DB = sqlite['DatabaseSync']; new DB('x.db');\n",
    "const sqlite = require('node:sqlite'); const DB = sqlite[/* member */ 'DatabaseSync']; new DB('probe.db');\n",
    "const DB = require('node:sqlite')['DatabaseSync']; new DB('x.db');\n",
    "const DB = require('node:sqlite')?.DatabaseSync; new DB('x.db');\n",
    "let DB; DB = require('node:sqlite')['DatabaseSync']; new DB('x.db');\n",
    "let DB; DB ??= require('node:sqlite').DatabaseSync; new DB('probe.db');\n",
    "let sqlite; (sqlite = require('node:sqlite')); new sqlite.DatabaseSync('probe.db');\n",
    "let sqlite; const alias = sqlite = require('node:sqlite'); new sqlite.DatabaseSync('probe.db');\n",
    "const DB = true ? require('node:sqlite').DatabaseSync : null; new DB('probe.db');\n",
    "const noop = 0, DB = require('node:sqlite').DatabaseSync; new DB('probe.db');\n",
    "const sqlite = require('node:sqlite'); const DB = sqlite.DatabaseSync; new DB('state.db');\n",
    "const DB = require('node:sqlite').DatabaseSync; new DB/* call */('probe.db');\n",
    "const sqlite = require('node:sqlite'); let DB; DB = sqlite.DatabaseSync; new DB('state.db');\n",
    "const sqlite = require('node:sqlite'); const DB = sqlite.DatabaseSync; const Alias = DB; new Alias('state.db');\n",
    "const { DatabaseSync: DB } = require('node:sqlite'); new DB('state.db');\n",
    "const {\n  DatabaseSync: DB\n} = require('node:sqlite'); new DB('state.db');\n",
    "const { DatabaseSync: DB } = (require('node:sqlite')); new DB('state.db');\n",
    "if (true) { const { DatabaseSync: DB } = require('node:sqlite'); new DB('state.db'); }\n",
    "const { 'DatabaseSync': DB } = (require('node:sqlite')); new DB('state.db');\n",
    "const { 'Database\\u0053ync': DB } = require('node:sqlite'); new DB('state.db');\n",
    "const { 'Database\\123ync': DB } = require('node:sqlite'); new DB('state.db');\n",
    "const noop = 0, { DatabaseSync: DB } = require('node:sqlite'); new DB('probe.db');\n",
    "class DB extends require('node:sqlite').DatabaseSync {}; new DB('probe.db');\n",
    "new (class extends require('node:sqlite').DatabaseSync {})('probe.db');\n",
    "new class extends require('node:sqlite').DatabaseSync {}('probe.db');\n",
    "const DB = (class extends require('node:sqlite').DatabaseSync {}); new DB('probe.db');\n",
    "let DB; ({ DatabaseSync: DB } = require('node:sqlite')); new DB('probe.db');\n"
  ]) {
    fs.writeFileSync(path.join(scripts, 'write.js'), code);
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /undeclared operation: local-write|sensitive module (?:namespace|require shape|dynamic imports|quoted names)|escaped JavaScript property keys/, code);
  }
  for (const code of [
    "const inspector = require('node:inspector'); console.log(inspector.url(), 'open the report');\n",
    "const inspector = require('node:inspector'); const open = () => inspector.url(); console.log(open());\n",
    "const text = \"import { open as listen } from 'node:inspector'\"; console.log(text);\n",
    "const text = \"require('node:inspector')\"; console.log(text);\n",
    "const source = {}; const { url = \"require('node:inspector')\" } = source; console.log(url);\n",
    "const { url = 'open' } = require('node:inspector'); console.log(url);\n",
    "const { url = { href: '' } } = require('node:inspector'); console.log(url.href);\n",
    "require('node:sqlite'); console.log('DatabaseSync');\n",
    "const text = \"import { DatabaseSync as DB } from 'node:sqlite'\"; console.log(text);\n",
    "const source = {}; const { backup = \"require('node:sqlite')\" } = source; console.log(backup);\n",
    "// \"require import\"\n/* module.require; this does not require network access */\nconsole.log('safe');\n",
    "const words = ['require', 'import']; console.log(words);\n",
    "if (true) ['require'].forEach((word) => console.log(word));\n",
    "void ['require']; typeof ['import'];\n",
    "for (const word of ['require']) console.log(word); if ('x' in ['import']) {} const value = []; if (value instanceof ['require']) {} switch ('x') { case ['import']: break; } class Example extends ['require'] {}\n",
    "if (true) {}\n['require'].forEach((word) => console.log(word)); function complete() {}\n['import'].forEach((word) => console.log(word)); while (false) { break\n['require']; }\n",
    "async function load() { await ['import']; } function* generate() { yield ['require']; }\n",
    "require('node:sqlite'); const DatabaseSync = 'metadata'; console.log(DatabaseSync);\n",
    "const { backup = 'DatabaseSync' } = require('node:sqlite'); console.log(backup);\n",
    "const { backup = () => ({ name: 'DatabaseSync' }) } = require('node:sqlite'); console.log(backup());\n",
    "const label = '\\u2603'; console.log(label);\n",
    "const label = 'line\\nfeed'; console.log(label);\n",
    "// \\u2603\nconsole.log('safe');\n"
  ]) {
    fs.writeFileSync(path.join(scripts, 'write.js'), code);
    assert.doesNotThrow(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), code);
  }
  const esmPath = path.join(scripts, 'write.mjs');
  fs.rmSync(path.join(scripts, 'write.js'));
  fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8')
    .replace('scripts/write.js', 'scripts/write.mjs'));
  for (const code of [
    "import { createTracing as create } from 'node:trace_events'; create({ categories: ['node'] }).enable();\n",
    "import { writeHeapSnapshot as snapshot } from 'node:v8'; snapshot('heap.heapsnapshot');\n",
    "import * as sqlite from 'node:sqlite'; new sqlite.DatabaseSync('state.db');\n",
    "import { DatabaseSync as DB } from 'node:sqlite'; new DB('state.db');\n",
    "import {\n  DatabaseSync as DB\n} from 'node:sqlite'; new DB('state.db');\n",
    "import { 'Database\\u0053ync' as DB } from 'node:sqlite'; new DB('state.db');\n",
    "import sqlite from 'node:sqlite'; new sqlite.DatabaseSync('state.db');\n",
    "import { default as sqlite } from 'node:sqlite'; new sqlite.DatabaseSync('state.db');\n",
    "export { DatabaseSync as DB } from 'node:sqlite';\n",
    "export *\nfrom 'node:sqlite';\n",
    "export * as sqlite\nfrom 'node:sqlite';\n",
    "import * as ι from 'node:sqlite'; new ι.DatabaseSync('state.db');\n"
  ]) {
    fs.writeFileSync(esmPath, code);
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /undeclared operation: local-write|sensitive module (?:default imports|re-exports|quoted names)|non-ASCII JavaScript tokens|escaped JavaScript property keys/, code);
  }
  for (const code of [
    "import * as inspector from 'node:inspector'; inspector.open(9229);\n",
    "import { open as listen } from 'node:inspector'; listen(9229);\n",
    "import {\n  open as listen\n} from 'node:inspector'; listen(9229);\n",
    "import { 'op\\u0065n' as listen } from 'node:inspector'; listen(9229);\n",
    "import inspector from 'node:inspector'; inspector.open(9229);\n",
    "import { default as inspector } from 'node:inspector'; inspector.open(9229);\n",
    "export { open as listen } from 'node:inspector';\n",
    "export *\nfrom 'node:inspector';\n",
    "export * as inspector\nfrom 'node:inspector';\n",
    "import * as ι from 'node:inspector'; ι.open(9229);\n"
  ]) {
    fs.writeFileSync(esmPath, code);
    assert.throws(() => auditCandidate({
      root: values.root, candidate: relative, target: 'architecture'
    }), /undeclared operation: connector-write|sensitive module (?:default imports|re-exports|quoted names)|non-ASCII JavaScript tokens|escaped JavaScript property keys/, code);
  }
  fs.writeFileSync(esmPath, "await ['import'];\n");
  assert.doesNotThrow(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }));
  fs.writeFileSync(esmPath, `${"await ['import'];\n".repeat(17)}`);
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /more than 16 array\/member parser probes/);
  fs.writeFileSync(esmPath, [
    "import './probe-a.mjs';",
    "await ['import'];\n".repeat(11)
  ].join('\n'));
  fs.writeFileSync(path.join(scripts, 'probe-a.mjs'), [
    "import './probe-b.mjs';",
    "await ['import'];\n".repeat(11)
  ].join('\n'));
  fs.writeFileSync(path.join(scripts, 'probe-b.mjs'), "await ['import'];\n".repeat(11));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /more than 32 total array\/member parser probes/);
  fs.rmSync(path.join(scripts, 'probe-a.mjs'));
  fs.rmSync(path.join(scripts, 'probe-b.mjs'));
  fs.writeFileSync(esmPath, ' '.repeat((1024 * 1024) + 1));
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /more than 1048576 total JavaScript bytes/);
  const chainedModules = Array.from({ length: 64 }, (_, index) =>
    path.join(scripts, `source-${String(index).padStart(2, '0')}.mjs`)
  );
  fs.writeFileSync(esmPath, "import './source-00.mjs';\n");
  for (let index = 0; index < chainedModules.length; index += 1) {
    const next = chainedModules[index + 1];
    fs.writeFileSync(chainedModules[index], next
      ? `import './${path.basename(next)}';\n`
      : 'export const value = 1;\n');
  }
  assert.throws(() => auditCandidate({
    root: values.root, candidate: relative, target: 'architecture'
  }), /more than 64 JavaScript files/);
  fs.rmSync(esmPath);
  for (const modulePath of chainedModules) fs.rmSync(modulePath);
  fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8')
    .replace('scripts/write.mjs', 'scripts/write.js'));
  fs.writeFileSync(path.join(scripts, 'write.js'),
    "fetch('https://example.invalid', { method: 'POST' });\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: connector-write/);
  fs.writeFileSync(path.join(scripts, 'write.js'), [
    "const https = require('node:https');",
    "https.request('https://example.invalid');",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: connector-write/);
  fs.rmSync(path.join(scripts, 'write.js'));
  fs.writeFileSync(skillPath, fs.readFileSync(skillPath, 'utf8').replace(
    '\nRead `scripts/write.js`.\n',
    '\n'
  ));

  prepareRow(values.root, 'architecture', { operations: ['push', 'read'] });
  fs.writeFileSync(skillPath, withAuthorizationBlock(
    fs.readFileSync(skillPath, 'utf8'),
    'Read `scripts/push.js`.\n'
  ));
  const contractPath = path.join(values.root, relative, 'migration-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  contract.authorization.sensitive_operations = ['push'];
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "const root = '.';",
    "const subject = '0000000000000000000000000000000000000000';",
    "let output = '';",
    "output = execFileSync('git', ['cat-file', '--batch-check=%(objecttype)'], { cwd: root, encoding: 'utf8', input: subject, stdio: ['ignore', 'pipe', 'pipe'] });",
    "execFileSync('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "const root = '.';",
    "execFileSync('git', ['status'], { cwd: root, encoding: 'utf8', env: {}, stdio: ['ignore', 'pipe', 'pipe'] });",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /closed literal form/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['-C', 'repo', 'push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "import { execFileSync as run } from 'node:child_process';",
    "run('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /syntax check failed|unsupported or aliased child-process import/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "import cp from 'node:child_process';",
    "const method = 'execFileSync';",
    "cp[method]('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /syntax check failed|dynamic computed member access|child_process must use direct named imports/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const cp = await import('node:child_process');",
    "cp.execFileSync('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /syntax check failed|dynamic computed member access|child_process must use direct named imports/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { fork } = require('node:child_process');",
    "fork('./child.js');",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /child_process\.fork is unsupported/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const cp = require('node:child_process');",
    "const method = 'execFileSync';",
    "cp[method]('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /dynamic computed member access|child_process must use direct named imports/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const cp = require('node:child_process');",
    "const second = cp;",
    "const method = 'execFileSync';",
    "second[method]('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /dynamic computed member access|child_process must use direct named imports/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const cp = require('node:child_process');",
    "cp['execFileSync']('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /dynamic computed member access|child_process must use direct named imports/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const run = require('node:child_process').execFileSync;",
    "run('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /child_process must use direct named imports/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { exec } = require('node:child_process');",
    "exec(process.env.COMMAND);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /closed literal form/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['status'].concat(['push']));",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /closed literal form/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execSync } = require('node:child_process');",
    "execSync('git push && curl https://example.invalid');",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /compound shell subprocess/);
  for (const subcommand of ['tag', 'checkout', 'clean']) {
    fs.writeFileSync(path.join(scripts, 'push.js'), [
      "const { execFileSync } = require('node:child_process');",
      `execFileSync('git', ['${subcommand}', 'fixture']);`,
      ''
    ].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported git subcommand/);
  }
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('bash', ['-c', 'git push']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported subprocess executable/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('gh', ['pr', 'create']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: pr-write/);
  for (const code of [
    "execFileSync('gh', ['pr', 'view', 'x]y']);",
    "execFileSync('git', ['status', 'x]y']);",
    'execFileSync("git", ["log", "--grep=don\'t"]);',
    "execFileSync('git', ['pu\\sh', 'origin', 'main']);"
  ]) {
    fs.writeFileSync(path.join(scripts, 'push.js'), [
      "const { execFileSync } = require('node:child_process');",
      code,
      "execFileSync('git', ['push', 'origin', 'main']);",
      ''
    ].join('\n'));
    assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
      true, code);
  }
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync, execSync } = require('node:child_process');",
    'execSync("git log --grep=\\\"don\'t\\\"");',
    "execFileSync('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  assert.equal(auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }).ok,
    true);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execSync } = require('node:child_process');",
    'execSync("git status\\ngit push origin main");',
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /compound shell subprocess/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    `execFileSync('gh', ['pr', 'create', '${'x'.repeat(2100)}']);`,
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: pr-write/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('gh', ['--repo', 'o/r', 'pr', 'review', '--approve']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: pr-write/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', args);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /closed literal form/);
  fs.writeFileSync(path.join(scripts, 'push.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['push', 'origin', 'main']);",
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(scripts, 'push.py'), 'print("write")\n');
  fs.appendFileSync(skillPath, '\nAlso execute `scripts/push.py`.\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported executable type/);
});
