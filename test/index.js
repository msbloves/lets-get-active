global.TEST_MODE = true;
process.env.APP_ID = "amzn1.ask.skill.9200600c-ea41-4400-adbe-beb6efef00b1";
const fs = require("fs");
const context = require('aws-lambda-mock-context');
const index = require("../index");
const async = require("async");
const chai = require("chai").should();
const path = require("path");

describe("Event processing:", function(done) {
	async.each(fs.readdirSync("./test/events"), function (dirname, dir_cb) {
		if(fs.lstatSync(path.join("./test/events", dirname)).isDirectory()) {
			describe("State:" + dirname, function() {
				async.each(fs.readdirSync(path.resolve(__dirname, path.join("events", dirname))), function(filename) {
					if(!filename.endsWith(".response.json")) {
						it("Case:" + filename, function (event_done) {
							const file_content = require("./" + path.join("events", dirname, filename));
							const ctx = context();
							index.handler(file_content, ctx);
							ctx.Promise
								.then(response => {
									try {
										const response_filename = path.join("events", dirname, filename.substring(0,filename.length - 5) + ".response.json");
										if(!fs.existsSync(path.resolve(__dirname, response_filename))) {
											console.log(`Response for ${response_filename} does not exist:`);
											console.log(JSON.stringify(response, null, 2));
											return event_done(`Response file ${response_filename} does not exist yet.`);
										}
										const expected_response = require("./" + response_filename);
										response.should.deep.equal(expected_response);			
										return event_done();
									}
									catch(err) {
										return event_done(err);
									}
								})
								.catch(event_done);
						});
					}
				}, dir_cb);
			});
		}
		else { dir_cb(); }
	}, done);
});
