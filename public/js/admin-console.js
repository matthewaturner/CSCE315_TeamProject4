
// Toggles mobile navbar when item selected
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});

$(document).ready(function() {
    $('form').submit(function (e) {
        e.preventDefault();
        $.post('/emails/', {bodybegin: $('#bodybegin').val()}, function() {
            console.log("Emails Sent");
        });

        //$.post('/points', {name: $('#input-name').val()}, printPoints);
        //this.reset();
    });
});
