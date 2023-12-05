/**
 * @name WakaTime
 * @author WakaTime
 * @description Automatic time tracking and stats about your Discord usage.
 * @version 1.0.0
 */

const fs = require('fs');

module.exports = class WakaTime {
  constructor(meta) {
    this.meta = meta;
    this.lastHeartbeatAt = 0;
    this.debug = false;
  }

  start() {
    console.log(`Initializing WakaTime plugin v${this.meta.version}`);
    if (readSetting(getHomeDirectory() + '/.wakatime.cfg', 'settings', 'debug') == 'true') {
      this.debug = true;
      console.log('WakaTime debug mode enabled');
    }
    this.handler = this.handleAction.bind(this);
    document.addEventListener('click', this.handler);
  }

  stop() {
    console.log('Unloading WakaTime plugin');
    document.removeEventListener('click', this.handler);
  }

  getSettingsPanel() {
    const key = readSetting(getHomeDirectory() + '/.wakatime.cfg', 'settings', 'api_key') || '';
    let template = document.createElement('template');
    template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">API Key <input name="api_key" value=${key} size="50" /><p><a href="https://wakatime.com/api-key" target="_blank">https://wakatime.com/api-key</a></p></div>`;
    template.content.firstElementChild.querySelector('input').addEventListener('keyup', this.onChangeApiKey);
    return template.content.firstElementChild;
  }

  onChangeApiKey(e) {
    const key = e.target.value;
    setSetting(getHomeDirectory() + '/.wakatime.cfg', 'settings', 'api_key', key);
  }

  enoughTimePassed() {
    return this.lastHeartbeatAt + 120000 < Date.now();
  }

  async handleAction() {
    const time = Date.now();
    if (!this.enoughTimePassed()) return;
    this.lastHeartbeatAt = time;
    await this.sendHeartbeat(time);
  }

  async sendHeartbeat(time) {
    const key = readSetting(getHomeDirectory() + '/.wakatime.cfg', 'settings', 'api_key');
    if (!key) return;
    if (this.debug) {
      console.log(`Sending heartbeat to WakaTime API.`);
    }

    const url = 'https://api.wakatime.com/api/v1/users/current/heartbeats';
    const body = JSON.stringify({
      time: time / 1000,
      entity: 'Discord',
      type: 'app',
      //project: project,
      plugin: `discord-wakatime/${this.meta.version}`,
    });
    const response = await BdApi.Net.fetch(url, {
      method: 'POST',
      body: body,
      headers: {
        Authorization: `Basic ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': new TextEncoder().encode(body).length,
      },
    });
    const data = await response.text();
    if (response.status < 200 || response.status >= 300) console.warn(`WakaTime API Error ${response.status}: ${data}`);
  }
};

function getHomeDirectory() {
  let home = process.env.WAKATIME_HOME;
  if (home && home.trim() && fs.existsSync(home.trim())) return home.trim();
  if (process.env.USERPROFILE) return process.env.USERPROFILE;
  if (process.env.HOME) return process.env.HOME;
  return process.cwd();
}

function readSetting(file, section, key) {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    let currentSection = '';
    let lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (startsWith(line.trim(), '[') && endsWith(line.trim(), ']')) {
        currentSection = line
          .trim()
          .substring(1, line.trim().length - 1)
          .toLowerCase();
      } else if (currentSection === section) {
        let parts = line.split('=');
        let currentKey = parts[0].trim();
        if (currentKey === key && parts.length > 1) {
          return removeNulls(parts[1].trim());
        }
      }
    }
  } catch (e) {}
  return '';
}

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch (e) {}
  return '';
}

function setSetting(file, section, key, val) {
  let content = readFile(file);

  let contents = [];
  let currentSection = '';

  let found = false;
  let lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (startsWith(line.trim(), '[') && endsWith(line.trim(), ']')) {
      if (currentSection === section && !found) {
        contents.push(removeNulls(key + ' = ' + val));
        found = true;
      }
      currentSection = line
        .trim()
        .substring(1, line.trim().length - 1)
        .toLowerCase();
      contents.push(removeNulls(line));
    } else if (currentSection === section) {
      let parts = line.split('=');
      let currentKey = parts[0].trim();
      if (currentKey === key) {
        if (!found) {
          contents.push(removeNulls(key + ' = ' + val));
          found = true;
        }
      } else {
        contents.push(removeNulls(line));
      }
    } else {
      contents.push(removeNulls(line));
    }
  }

  if (!found) {
    if (currentSection !== section) {
      contents.push('[' + section + ']');
    }
    contents.push(removeNulls(key + ' = ' + val));
  }

  fs.writeFileSync(file, contents.join('\n'));
}

function startsWith(outer, inner) {
  return outer.slice(0, inner.length) === inner;
}

function endsWith(outer, inner) {
  return inner === '' || outer.slice(-inner.length) === inner;
}

function removeNulls(s) {
  return s.replace(/\0/g, '');
}
