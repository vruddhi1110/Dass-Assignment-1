const regController = require('../controllers/registrationController');

jest.mock('../models/Registration', () => ({
  findById: jest.fn()
}));
jest.mock('../models/Event', () => ({
  updateOne: jest.fn()
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn()
}));

// Mock nodemailer transport
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn((opts, cb) => cb(null, { response: 'ok' })) }))
}));

const Registration = require('../models/Registration');
const Event = require('../models/Event');
const QRCode = require('qrcode');

describe('Merchandise payment approval flow', () => {
  let req, res;

  beforeEach(() => {
    req = { params: { id: 'reg1' }, user: { id: 'org1', role: 'Organizer' }, body: {} };
    res = { json: jest.fn(), status: jest.fn(() => res), send: jest.fn(), statusCode: 200 };

    Registration.findById.mockReset();
    Event.updateOne.mockReset();
    QRCode.toDataURL.mockReset();
  });

  test('approveRegistration finalizes stock and generates ticket', async () => {
    const fakeReg = {
      _id: 'reg1',
      participantId: 'p1',
      status: 'Pending',
      merchandiseSelection: { variantId: 'var1', quantity: 2 },
      eventId: {
        _id: 'evt1',
        name: 'Merch Event',
        organizerId: 'org1',
        merchandiseItems: [{ _id: 'var1', variantName: 'V1', stockQuantity: 10, reservedQuantity: 2 }]
      },
      save: jest.fn().mockResolvedValue(true)
    };

  Registration.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(fakeReg) });
    Event.updateOne.mockResolvedValue({ modifiedCount: 1 });
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,FAKE');

    await regController.approveRegistration(req, res);

    expect(Event.updateOne).toHaveBeenCalled();
    expect(QRCode.toDataURL).toHaveBeenCalled();
    expect(fakeReg.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ msg: 'Registration approved and ticket generated' }));
  });

  test('rejectRegistration releases reservation and marks rejected', async () => {
    const fakeReg = {
      _id: 'reg2',
      participantId: 'p2',
      status: 'Pending',
      merchandiseSelection: { variantId: 'var2', quantity: 1 },
      eventId: {
        _id: 'evt2',
        name: 'Merch Event 2',
        organizerId: 'org1'
      },
      save: jest.fn().mockResolvedValue(true)
    };

  Registration.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(fakeReg) });
    Event.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await regController.rejectRegistration(req, res);

    expect(Event.updateOne).toHaveBeenCalled();
    expect(fakeReg.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ msg: 'Registration rejected' }));
  });
});
