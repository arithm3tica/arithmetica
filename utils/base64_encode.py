import base64

file = open('foo.html','rb')
file_read = file.read()
file_encode=base64.encodestring(file_read)
file_result = open('foo_encode.txt','wb')
file_result.write(file_encode)