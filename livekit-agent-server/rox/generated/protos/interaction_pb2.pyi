from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ClientUIActionType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    NO_ACTION: _ClassVar[ClientUIActionType]
    SHOW_ALERT: _ClassVar[ClientUIActionType]
    UPDATE_TEXT_CONTENT: _ClassVar[ClientUIActionType]
    TOGGLE_ELEMENT_VISIBILITY: _ClassVar[ClientUIActionType]
NO_ACTION: ClientUIActionType
SHOW_ALERT: ClientUIActionType
UPDATE_TEXT_CONTENT: ClientUIActionType
TOGGLE_ELEMENT_VISIBILITY: ClientUIActionType

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

class AgentToClientUIActionRequest(_message.Message):
    __slots__ = ("request_id", "action_type", "target_element_id", "parameters")
    class ParametersEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    ACTION_TYPE_FIELD_NUMBER: _ClassVar[int]
    TARGET_ELEMENT_ID_FIELD_NUMBER: _ClassVar[int]
    PARAMETERS_FIELD_NUMBER: _ClassVar[int]
    request_id: str
    action_type: ClientUIActionType
    target_element_id: str
    parameters: _containers.ScalarMap[str, str]
    def __init__(self, request_id: _Optional[str] = ..., action_type: _Optional[_Union[ClientUIActionType, str]] = ..., target_element_id: _Optional[str] = ..., parameters: _Optional[_Mapping[str, str]] = ...) -> None: ...

class ClientUIActionResponse(_message.Message):
    __slots__ = ("request_id", "success", "message")
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    request_id: str
    success: bool
    message: str
    def __init__(self, request_id: _Optional[str] = ..., success: bool = ..., message: _Optional[str] = ...) -> None: ...
