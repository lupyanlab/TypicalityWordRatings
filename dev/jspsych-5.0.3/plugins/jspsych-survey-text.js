/**
 * jspsych-survey-text
 * a jspsych plugin for free response survey questions
 *
 * Josh de Leeuw
 *
 * documentation: docs.jspsych.org
 *
 */


jsPsych.plugins['survey-text'] = (function() {

  var plugin = {};

  plugin.trial = function(display_element, trial) {

    trial.preamble = typeof trial.preamble == 'undefined' ? "" : trial.preamble;
    if (typeof trial.rows == 'undefined') {
      trial.rows = [];
      for (var i = 0; i < trial.questions.length; i++) {
        trial.rows.push(1);
      }
    }
    if (typeof trial.columns == 'undefined') {
      trial.columns = [];
      for (var i = 0; i < trial.questions.length; i++) {
        trial.columns.push(40);
      }
    }

    // if any trial variables are functions
    // this evaluates the function and replaces
    // it with the output of the function
    trial = jsPsych.pluginAPI.evaluateFunctionParameters(trial);

    // show preamble text
    display_element.append($('<div>', {
      "id": 'jspsych-survey-text-preamble',
      "class": 'jspsych-survey-text-preamble'
    }));

    $('#jspsych-survey-text-preamble').html(trial.preamble);

    // add questions
    for (var i = 0; i < trial.questions.length; i++) {
      // create div
      display_element.append($('<div>', {
        "id": 'jspsych-survey-text-' + i,
        "class": 'jspsych-survey-text-question'
      }));

      // add question text
      // add text box
      // add submit button
      $("body").append(`
        <form action="">
          <p class="jspsych-survey-text">${trial.questions[i]}</p>
          <input id="answer" class="form-control" name="#jspsych-survey-text-response-${i}" placeholder="Your answer..." type="text" autofocus>
          <div id="message"></div>
	  <br>
	  <h4>How familiar are you with the items pictured above?</h4>
	  <div style="display:flex;"> 
	   <span>Not familiar at all</span>
	    <input type="radio" name="familiarity" value="1" style="margin-left:1em;" />
	    <input type="radio" name="familiarity" value="2" style="margin-left:1em;" />
	    <input type="radio" name="familiarity" value="3" style="margin-left:1em;" />
	    <input type="radio" name="familiarity" value="4" style="margin-left:1em;" />
	    <input type="radio" name="familiarity" value="5" style="margin-left:1em;" />
	    <span style="margin-left:1em;">Very familiar</span>
	  </div>
          <div id="message-2"></div>
          <button type="submit" id="jspsych-survey-text-next" class="jspsych-btn jspsych-survey-text" />
	</form>
      `)

    }
    $('#answer').focus();
    window.setTimeout(() => {
      $('#answer').val('');
    },1)
    $("#jspsych-survey-text-next").html('Submit Answer');
    $("#jspsych-survey-text-next").click(function() {
      if ($('#answer').val().replace(/\s/g,'') == "") {
        document.querySelector('#message').innerHTML = "Answer must be filled out";
        return false;
      } else if (!document.querySelector('input[name=familiarity]:checked')) {
	document.querySelector('#message-2').innerHTML = "Answer must be filled out";
        return false;
      }
      // measure response time
      var endTime = (new Date()).getTime();
      var response_time = endTime - startTime;

      // create object to hold responses
      var question_data = {};
      var question_data = {Q0: $('#answer').val()};
	
      const familiarity  = Number(document.querySelector('input[name=familiarity]:checked').value);
      // save data
      var trialdata = {
        "rt": response_time,
        "responses": question_data,
        "familiarity": familiarity,
      };

      display_element.html('');

      // next trial
      jsPsych.finishTrial(trialdata);
    });

    var startTime = (new Date()).getTime();
  };

  return plugin;
})();
