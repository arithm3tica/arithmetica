#!/bin/bash



while read p; do
	if [[ $p == "<script src='src/app.js'></script>" ]]; then
		echo "<script>"
		cat js/public/js/app.js
		echo "</script>"
	else
		echo $p
	fi
done < js/public/arithmetica.html > arithmetica.html
