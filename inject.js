let roomID = undefined;

setInterval(function() {
	if (window.room && roomID != window.room.id) {
		roomID = window.room.id;
		
		window.postMessage({
			type: "SHOWDOWN_ANNOUNCER",
			source: "PAGE",
			content: "ROOM_CHANGE",
			roomID: roomID
		}, "*");

		if (window.room.battle && window.room.battle.turn < 1) { // Need fix, triggers on refresh
			window.postMessage({
				type: "SHOWDOWN_ANNOUNCER",
				source: "PAGE",
				content: "TEAM_PREVIEW"
			}, "*");
		}

		// Hijack the function that receives Sim Protocol messages from the server
		window.room.receive = function(data) {
			// Pass the data to the content script
			window.postMessage({
				type: "SHOWDOWN_ANNOUNCER",
				source: "PAGE",
				content: "SIM_DATA",
				text: data
			}, "*");
			
			// Make sure the room gets the data too
			this.add(data);
		}
	}
}, 100);