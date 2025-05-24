from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class Empty(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class FrontendButtonClickRequest(_message.Message):
    __slots__ = ("button_id", "custom_data")
    BUTTON_ID_FIELD_NUMBER: _ClassVar[int]
    CUSTOM_DATA_FIELD_NUMBER: _ClassVar[int]
    button_id: str
    custom_data: str
    def __init__(self, button_id: _Optional[str] = ..., custom_data: _Optional[str] = ...) -> None: ...

class AgentResponse(_message.Message):
    __slots__ = ("status_message", "data_payload")
    STATUS_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    DATA_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    status_message: str
    data_payload: str
    def __init__(self, status_message: _Optional[str] = ..., data_payload: _Optional[str] = ...) -> None: ...
