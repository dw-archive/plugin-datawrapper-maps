
import sys
import json
import csv
import dataset
from os.path import exists

def toint(s):
    try:
        return int(s)
    except:
        return None

locale = json.load(open('../static/maps/1-world/locale.json'))
mapjson = json.load(open('../static/maps/1-world/map.json'))

if not exists('countries.db'):
    ds = dataset.connect('sqlite:///countries.db')
    if not exists('countryInfo.txt'):
        print "downloading country information from geonames.org"
        import requests
        r = requests.get('http://download.geonames.org/export/dump/countryInfo.txt')
        f = open('countryInfo.txt', 'w')
        f.write(r.text)
        f.close()
    d = csv.reader(open('countryInfo.txt'), dialect='excel-tab')
    for row in d:
        if row[0][0] == '#':
            continue
        country = dict(
            iso2=row[0],
            iso3=row[1],
            isonum=row[2],
            fips=row[3],
            name=row[4],
            capital=row[5],
            area=toint(row[6]),
            population=toint(row[7]),
            continent=row[8],
            tld=row[9],
            currencyCode=row[10],
            currency=row[11]
        )
        for lang in locale:
            if row[0] in locale[lang]:
                country['name_%s' % lang] = locale[lang][row[0]]
        ds['countries'].insert(country)
else:
    ds = dataset.connect('sqlite:///countries.db')


if len(sys.argv) < 2:
    exit()

if sys.argv[1] == 'africa-locale':
    out = dict()
    for lang in locale:
        out[lang] = dict()
        for c in ds.query('SELECT * FROM countries WHERE continent = "AF"'):
            k = 'name_%s' % lang
            if k in c:
                out[lang][c['iso3']] = c[k]
    json.dump(out, open('../static/maps/3-africa/locale.json', 'w'))

if sys.argv[1] == 'africa-alias-keys':
    iso3_iso2 = dict()
    iso3_isonum = dict()
    for c in ds.query('SELECT iso3, iso2, isonum FROM countries WHERE continent = "AF"'):
        iso3_iso2[c['iso3']] = c['iso2']
        iso3_isonum[c['iso3']] = c['isonum']
    print json.dumps([iso3_iso2, iso3_isonum])


if sys.argv[1] == 'south-america-keys':
    keys = []
    for c in ds.query('SELECT iso3 FROM countries WHERE continent = "SA"'):
        keys.append(str(c['iso3']))
    print keys


if sys.argv[1] == 'north-america-keys':
    keys = []
    for c in ds.query('SELECT iso3 FROM countries WHERE continent = "NA"'):
        keys.append(str(c['iso3']))
    print keys


if sys.argv[1] == 'sa-alias-keys':
    iso3_iso2 = dict()
    iso3_isonum = dict()
    for c in ds.query('SELECT iso3, iso2, isonum FROM countries WHERE continent = "SA"'):
        iso3_iso2[c['iso3']] = c['iso2']
        iso3_isonum[c['iso3']] = c['isonum']
    print json.dumps([iso3_iso2, iso3_isonum])


if sys.argv[1] == 'na-alias-keys':
    iso3_iso2 = dict()
    iso3_isonum = dict()
    for c in ds.query('SELECT iso3, iso2, isonum FROM countries WHERE continent = "NA"'):
        iso3_iso2[c['iso3']] = c['iso2']
        iso3_isonum[c['iso3']] = c['isonum']
    print json.dumps([iso3_iso2, iso3_isonum])


if sys.argv[1] == 'sa-locale':
    out = dict()
    for lang in locale:
        out[lang] = dict()
        for c in ds.query('SELECT * FROM countries WHERE continent = "SA"'):
            k = 'name_%s' % lang
            if k in c:
                out[lang][c['iso3']] = c[k]
    json.dump(out, open('../static/maps/5-south-america/locale.json', 'w'))


if sys.argv[1] == 'na-locale':
    out = dict()
    for lang in locale:
        out[lang] = dict()
        for c in ds.query('SELECT * FROM countries WHERE continent = "NA"'):
            k = 'name_%s' % lang
            if k in c:
                out[lang][c['iso3']] = c[k]
    json.dump(out, open('../static/maps/4-north-america/locale.json', 'w'))

