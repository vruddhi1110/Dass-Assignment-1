const regController = require('../controllers/registrationController');

// Mock the Registration and AttendanceAudit models used inside the controller
jest.mock('../models/Registration', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/AttendanceAudit', () => ({
  create: jest.fn()
}));

const Registration = require('../models/Registration');
const AttendanceAudit = require('../models/AttendanceAudit');

describe('registrationController.markAttendance', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: { eventId: 'evt1' },
      user: { id: 'u1', role: 'Organizer' }
    };
    res = {
      json: jest.fn(),
      status: jest.fn(() => res),
      send: jest.fn()
    };
    Registration.findOne.mockReset();
    AttendanceAudit.create.mockReset();
  });

  test('marks attendance for valid ticket and creates audit', async () => {
    const fakeReg = {
      _id: 'r1',
      participantId: 'p1',
      ticketId: 'TICKET123',
      status: 'Successful',
      attendance: { isScanned: false },
      save: jest.fn().mockResolvedValue(true)
    };

    Registration.findOne.mockResolvedValue(fakeReg);
    req.body.ticketId = 'TICKET123';

    // spy on emitter
    const spyEmit = jest.spyOn(regController.attendanceEmitter, 'emit');

    await regController.markAttendance(req, res);

    expect(Registration.findOne).toHaveBeenCalledWith({ ticketId: 'TICKET123', eventId: 'evt1' });
    expect(fakeReg.save).toHaveBeenCalled();
    expect(AttendanceAudit.create).toHaveBeenCalledWith(expect.objectContaining({ registrationId: fakeReg._id, action: 'scan' }));
    expect(spyEmit).toHaveBeenCalledWith('attendanceUpdated', expect.objectContaining({ eventId: 'evt1', registrationId: 'r1' }));
    expect(res.json).toHaveBeenCalledWith({ msg: 'Attendance Marked', participant: fakeReg.participantId });
  });

  test('rejects already scanned ticket', async () => {
    const fakeReg = {
      _id: 'r2',
      participantId: 'p2',
      ticketId: 'TICKET456',
      status: 'Successful',
      attendance: { isScanned: true },
      save: jest.fn()
    };
    Registration.findOne.mockResolvedValue(fakeReg);
    req.body.ticketId = 'TICKET456';

  await regController.markAttendance(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  });
});
