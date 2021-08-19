let soundMap;
fetch(chrome.runtime.getURL('assets/soundMap.json')).then((response) => response.json()).then((result) => soundMap = result);

let rooms = {};
let currentRoom = undefined;

let soundManager = {
	audio: new Audio(),
	queue: [],
	chooseRandom: function(key) {
		let arr = soundMap[key].reduce(function(a, b) {
			return a.concat(b.files.map((f) => b.root + f));
		}, []);
		return arr[Math.floor(Math.random() * arr.length)];
	},
	play: function(url) {
		if (this.audio.paused || this.audio.ended) {
			this._play(url);
		} else {
			this.queue.push(url);
		}
	},
	_play: function(url) {
		this.audio.src = chrome.runtime.getURL("assets/" + url);
		this.audio.play();
	},
	init: function() {
		let self = this;
		this.audio.addEventListener('ended', function(){
			if (self.queue.length > 0) {
				self._play(self.queue.shift());
			}
		}, false);
	}
}
soundManager.init();

let dataHandler = {
	handle: function(data) {
		let lines = data.split("\n");
		if (lines[0] == "|init|battle") {
			// This is a catch-up message, ignore
			return;
		}
		for (let line of lines) {
			this.processLine(line);
		}
	},
	processLine: function(line) {
		params = line.slice(1).split("|");
		command = params[0];
		params.shift();

		switch (command) {
			case "move":
				let move = params[1];
				if (move in soundMap.moves.files) {
					soundManager.play(soundMap.moves.root + soundMap.moves.files[move]);
				}
				break;
			case "switch":
				let pokemon = params[1].split(", ")[0];
				if (pokemon in soundMap.pokemon.files) {
					soundManager.play(soundMap.pokemon.root + soundMap.pokemon.files[pokemon]);
				}
				break;
			case "-miss":
				// TODO: repeat misses / multi misses
				soundManager.play(soundManager.chooseRandom("miss"));
				break;
			case "-weather":
				if (params[1] == "[upkeep]") {
					break;
				}
				switch (params[0]) {
					case "Sandstorm":
						soundManager.play(soundManager.chooseRandom("sand_start"));
						break;
					case "RainDance":
						soundManager.play(soundManager.chooseRandom("rain_start"));
						break;
					case "SunnyDay":
						soundManager.play(soundManager.chooseRandom("sun_start"));
						break;
					case "none":
						switch (rooms[currentRoom].weather) {
							case "Sandstorm":
								soundManager.play(soundManager.chooseRandom("sand_end"));
								break;
							case "RainDance":
								soundManager.play(soundManager.chooseRandom("rain_end"));
								break;
							case "SunnyDay":
								soundManager.play(soundManager.chooseRandom("sun_end"));
								break;
						}

				}
				rooms[currentRoom].weather = params[0];
				break;
		}
	},
}

// Setup a listener to receive messages from the page
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source != window) {
	return;
  }

  if (event.data.type && (event.data.type == "SHOWDOWN_ANNOUNCER")
  && (event.data.source == "PAGE")) {
	switch (event.data.content) {
		case "SIM_DATA":
			dataHandler.handle(event.data.text)
			break;
		case "ROOM_CHANGE":
			currentRoom = event.data.roomID
			if (!(currentRoom in rooms)) {
				rooms[currentRoom] = {
					battleStartAnnounced: false,
					weather: "none"
				};
			}
			break;
		case "TEAM_PREVIEW":
			if (!rooms[currentRoom].battleStartAnnounced) {
				rooms[currentRoom].battleStartAnnounced = true;
				soundManager.play(soundManager.chooseRandom("battle_start"));
			}
			break;
	}
  }
}, false);

// Inject the script into the page to gain access to the page's true window object
let s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function() {
	this.remove();
};
(document.head || document.documentElement).appendChild(s);