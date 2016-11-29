const moment = require("moment");
const request = TEST_MODE ? require("../test/rp_mock") : require("request-promise");
const states = require("../states");
const log = require("../log");

function transform_results(result) {
	const results = [];
	for (var i=0; i<result.results.length; i++) {
		const race = result.results[i];
		const race_date = moment(new Date(race.activityRecurrences[0].activityStartDate));
		results.push({ 
			name : race.assetName, 
			location : race.place.placeName, 
			date : { value: race_date.format("YYYY-MM-DD"), readable: race_date.format("dddd MMMM Do") }
		});
	}
	return results;
}

module.exports = {
	'LaunchRequest': function () {
		this.emit('DoSearch'); 
	},
	"SetLocation": function() {
		this.attributes.location = this.event.request.intent.slots.location.value;
		log(`Set location to ${this.attributes.location}`);
		this.emit("DoSearch");
	},
	"SetDate": function() {
		this.attributes.start_date = moment(this.event.request.intent.slots.date.value, "YYYY-MM-DDTH").format("YYYY-MM-DD"); 
		log(`Set start_date to ${this.attributes.start_date}`);
		this.emit("DoSearch");
	},
        "ClearDate": function() {
		delete this.attributes.start_date;
		log(`Cleared start_date`);
		this.emit("DoSearch");
	},
	'DoSearch': function () {
		if(!this.attributes.location) { // No location: Must be a new user.
			log("No location, prompt new user to set location");
			return this.emit(":ask", "Let’s get active! I'll help you find some local races and activities. Let’s start with a location. In what city would you like me to search?", "You can give me any US city, state, or zipcode.");
		}

		if(!this.attributes.start_date) { // Default search for today
			this.attributes.start_date = TEST_MODE ? "2016-11-28" : moment().format("YYYY-MM-DD");
		}

		const location_formatted = encodeURIComponent(this.attributes.location);
		const start_date = moment(this.attributes.start_date, "YYYY-MM-DD"); 

		this.attributes.distance = this.attributes.distance || "20";

		const url = `http://api.amp.active.com/v2/search/?near=${location_formatted}&radius=${this.attributes.distance}&current_page=1&per_page=10&sort=distance&exclude_children=true&topic=Running&start_date=${this.attributes.start_date}..&api_key=${ACTIVE_API_KEY}`
		log(`Making API call to Active.com - ${url}`);

		request.get({ url: url, json: true })
			.then((result) => {
				log("Active.com search completed - " + JSON.stringify(result, null, 2));
				const total_results = result.total_results;
				if(total_results==0) {
					return this.emit(":ask", `I'm sorry, I didn't find any results within ${this.attributes.distance} miles of ${this.attributes.location} starting on or after ${start_date.format("dddd MMMM Do")}. When or where else would you like for me to search?`);
				}
				else {
					this.attributes.state = states.GOTO_LIST;
					this.attributes.results = transform_results(result);
					this.attributes.total_results = result.total_results;
					return this.emitWithState(":ask", `I found ${total_results} events within ${this.attributes.distance} miles of ${this.attributes.location}. Would you like to hear about them?`);
				}
			})
			.catch(function(err) {
				log(`An error occurred - ${err}`);
			});
	},
	"SetLocationAndClearDate": function() {
		this.attributes.location = this.event.request.intent.slots.location.value;
		delete this.attributes.start_date;
		this.emit("DoSearch");
	},
	'AMAZON.HelpIntent': function () {
		this.emit(':ask', "Ask me to find a race near any U.S. city, state, or zipcode.");
	},
	'AMAZON.CancelIntent': function () {
		this.emit('AMAZON.StopIntent');
	},
	'AMAZON.StopIntent': function () {
		this.emit(':tell', "No problem. Just remember that an active lifestyle keeps you happy and healthy.");
	},
	'Unhandled': function() {
		this.emit(':ask', "I'm sorry, I'm not sure what you meant. When or where would you like for me to search for events?");
	}
};
