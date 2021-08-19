let roomID = undefined;

// Setup a listener to receive messages from the content script
let assetMap;
window.postMessage({
	type: "SHOWDOWN_ANNOUNCER",
	source: "PAGE",
	content: "GET_ASSETMAP"
}, "*");
window.addEventListener("message", (event) => {
	if (event.source != window) {
		return;
	}

	if (event.data.type && (event.data.type == "SHOWDOWN_ANNOUNCER")
	&& (event.data.source == "CONTENT_SCRIPT")) {
		switch (event.data.content) {
			case "GET_ASSETMAP_RESPONSE":
				assetMap = event.data.assetMap;
				break;
		}
	}
}, false);

window.app._focusRoom_orig = window.app.focusRoom;
window.app.focusRoom = function(id, focusTextbox) {
	// TODO: handle room change

	window.app._focusRoom_orig(id, focusTextbox);
}

room.battle.scene._teamPreview_orig = room.battle.scene.teamPreview;
room.battle.scene.teamPreview = function() {
	soundManager.play("battle_start");

	room.battle.scene._teamPreview_orig();
}

// Hijack the mute function so we can mute too
let sendMuteMessage = function(muted) {
	window.postMessage({
		type: "SHOWDOWN_ANNOUNCER",
		source: "PAGE",
		content: "MUTE",
		muted: muted
	}, "*");
};
window.BattleSound._setMute_orig = window.BattleSound.setMute;
window.BattleSound.setMute = function(muted) {
	sendMuteMessage(muted);
	window.BattleSound._setMute_orig(muted);
};
sendMuteMessage(window.BattleSound.muted); // Send initial mute data

let soundManager = {
	play: function(name, type="sound") {
		window.postMessage({
			type: "SHOWDOWN_ANNOUNCER",
			source: "PAGE",
			content: "PLAY_SOUND",
			soundName: name,
			soundType: type
		}, "*");
	}
}

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
				if (assetMap.moves.includes(move)) {
					soundManager.play(move, "move");
				}
				break;
			case "switch":
				let pokemon = params[1].split(", ")[0];
				if (assetMap.pokemon.includes(pokemon)) {
					soundManager.play(pokemon, "pokemon");
				} else {
					soundManager.play("switch");
				}
				break;
			case "drag":
				soundManager.play("switch_forced");
				break;
			case "-miss":
				// TODO: repeat misses / multi misses
				soundManager.play("miss");
				break;
			case "-weather":
				if (params[1] == "[upkeep]") {
					break;
				}
				switch (params[0]) {
					case "Sandstorm":
						soundManager.play("sand_start");
						break;
					case "RainDance":
						soundManager.play("rain_start");
						break;
					case "SunnyDay":
						soundManager.play("sun_start");
						break;
					case "none":
						switch (rooms[currentRoom].weather) {
							case "Sandstorm":
								soundManager.play("sand_end");
								break;
							case "RainDance":
								soundManager.play("rain_end");
								break;
							case "SunnyDay":
								soundManager.play("sun_end");
								break;
						}

				}
				rooms[currentRoom].weather = params[0];
				break;
			case "-fail":
				soundManager.play("fail");
				break;
			case "-activate":
				if (params[1].startsWith("move: ")) {
					let move = params[1].split(": ")[1];
					switch (move) {
						case "Protect":
						case "Detect":
						case "Baneful Bunker":
						case "Crafty Shield":
						case "King's Shield":
						case "Mat Block":
						case "Obstruct":
						case "Quick Guard":
						case "Spiky Shield":
						case "Wide Guard":
						case "Max Guard":
							soundManager.play("blocked");
							break;
						case "Substitute":
							soundManager.play("sub_hit");
							break;
					}
				}
				break;
			case "-start":
				switch (params[1]) {
					case "Substitute":
						soundManager.play("sub_start");
						break;
				}
				break;
			case "-end":
				switch (params[1]) {
					case "Disable":
						soundManager.play("disable_end");
						break;
					case "Substitute":
						soundManager.play("sub_hit");
						break;
				}
				break;
			case "-enditem":
				let item = params[1];
				let reason = params[2];
				if (reason == "[eat]") {
					// TODO
				}
				break;
			case "-immune":
				soundManager.play("no_effect");
				break;
			case "-crit":
				soundManager.play("crit");
				break;
			case "-supereffective":
				soundManager.play("supereffective");
				break;
			case "-resisted":
				soundManager.play("not_very_effective");
		}
	},
}

// Hijack the function that receives Sim Protocol messages from the server
window.room.receive = function(data) {
	// Handle the data
	dataHandler.handle(data)
	
	// Make sure the room gets the data too
	this.add(data);
};