#!/bin/bash

cd js && npm run build && cd ..

while read p; do
	if [[ $p == "<script src='src/app.js'></script>" ]]; then
		echo "<script>"
		cat js/public/js/app.js
		echo "</script>"
	elif [[ $p == "<link rel='stylesheet' type='text/css' href='css/app.css'>" ]]; then
		echo "<style type='text/css'>"
		cat js/public/css/app.css
		echo "</style>"
	elif [[ $p == "<script src='js/ui.js'></script>" ]]; then
		echo "<script>"
		cat js/public/js/ui.js
		echo "</script>"
	else
		echo $p
	fi
done < js/public/arithmetica.html > index.html
